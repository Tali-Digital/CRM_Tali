import { db } from '../firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { CompanyType } from '../types';

export const PROSPECCAO_FOLLOWUP_STAGES = [
  'Cliente Selecionado',
  'Carta pronta',
  'Carta entregue',
  '1 Follow up',
  '2 follow up',
  '3 follow up',
  'Reunião Agendada',
  'Contato Encerrado',
  'Pós reunião - 1 Follow up',
  'Pós reunião - 2 follow up',
  'Pós reunião - 3 follow up',
  'Pós reunião - 4 follow up',
  'Pós reunião - 5 follow up',
  'Cliente fechado'
];

export function normalizeStageName(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getFollowupTargetStageName(record: any, linkedCarta?: any): string {
  const statusGeral = (record.statusGeral || record.status || '').trim();
  const normGeral = normalizeStageName(statusGeral);

  // 14. Cliente Fechado
  if (
    normGeral === 'cliente fechado' ||
    normGeral.includes('cliente fechado') ||
    normGeral.includes('contrato fechado') ||
    record.isContractClosed === true
  ) {
    return 'Cliente fechado';
  }

  // 8. Contato Encerrado
  if (
    normGeral === 'contato encerrado' ||
    normGeral === 'contrato encerrado' ||
    normGeral.includes('contato encerrado') ||
    normGeral.includes('contrato encerrado')
  ) {
    return 'Contato Encerrado';
  }

  // Pós Reunião Follow ups (9 a 13)
  if (normGeral.includes('pos reuniao') || normGeral.includes('pos-reuniao')) {
    if (normGeral.includes('5')) return 'Pós reunião - 5 follow up';
    if (normGeral.includes('4')) return 'Pós reunião - 4 follow up';
    if (normGeral.includes('3')) return 'Pós reunião - 3 follow up';
    if (normGeral.includes('2')) return 'Pós reunião - 2 follow up';
    if (normGeral.includes('1')) return 'Pós reunião - 1 follow up';
  }

  // 7. Reunião Agendada
  if (normGeral.includes('reuniao agendada') || normGeral === 'reuniao agendada') {
    return 'Reunião Agendada';
  }

  // 6. 3 follow up
  if (normGeral.includes('3 follow') || normGeral.includes('3º follow')) {
    return '3 follow up';
  }

  // 5. 2 follow up
  if (normGeral.includes('2 follow') || normGeral.includes('2º follow')) {
    return '2 follow up';
  }

  // 4. 1 follow up (SOMENTE SE EXPLICITAMENTE MARCADO NA FICHA!)
  // NÃO mapear 'entrar em contato' ou outros status genéricos aqui!
  if (normGeral.includes('1 follow') || normGeral.includes('1º follow') || normGeral === '1 follow up') {
    return '1 Follow up';
  }

  // 3. Carta entregue:
  // Se a carta foi entregue OU marcado 'carta entregue' no statusGeral
  const isEntregue = record.isEntregue === true || linkedCarta?.isEntregue === true || normGeral === 'carta entregue' || normGeral.includes('carta entregue');
  if (isEntregue) {
    return 'Carta entregue';
  }

  // 2. Carta pronta:
  // Se a carta está pronta (e não entregue) OU marcado 'carta pronta' no statusGeral
  const isFinalizada = record.isFinalizada === true || linkedCarta?.isFinalizada === true || normGeral === 'carta pronta' || normGeral.includes('carta pronta');
  if (isFinalizada) {
    return 'Carta pronta';
  }

  // Verificar se bate exatamente com algum outro dos 14 estágios
  for (const stage of PROSPECCAO_FOLLOWUP_STAGES) {
    if (normalizeStageName(stage) === normGeral) {
      return stage;
    }
  }

  // 1. Cliente Selecionado (Padrão para prospectos sem carta finalizada/entregue e sem follow up)
  return 'Cliente Selecionado';
}

export async function ensureFollowupListsInFirestore(companyId: CompanyType = 'digital'): Promise<any[]> {
  const listsQuery = query(
    collection(db, 'dynamic_lists'),
    where('sectorId', '==', 'prospeccao_followup')
  );
  const snapshot = await getDocs(listsQuery);
  let existingLists = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  if (existingLists.length === 0) {
    const createdLists = [];
    for (let i = 0; i < PROSPECCAO_FOLLOWUP_STAGES.length; i++) {
      const stageName = PROSPECCAO_FOLLOWUP_STAGES[i];
      const docRef = await addDoc(collection(db, 'dynamic_lists'), {
        name: stageName,
        order: i,
        sectorId: 'prospeccao_followup',
        companyId,
        createdAt: Timestamp.now()
      });
      createdLists.push({
        id: docRef.id,
        name: stageName,
        order: i,
        sectorId: 'prospeccao_followup',
        companyId
      });
    }
    existingLists = createdLists;
  }

  return (existingLists as any[]).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
}

/**
 * Sincroniza um prospecto com o card do Kanban no Follow Up.
 * Move o card para a lista correspondente ao stageName (ou cria se não existir).
 */
export async function syncProspectToFollowupCard(
  prospectId: string,
  stageName: string,
  prospectData?: any,
  companyId: CompanyType = 'digital'
): Promise<void> {
  if (!prospectId) return;

  const lists = await ensureFollowupListsInFirestore(companyId);
  const targetStage = getFollowupTargetStageName({
    statusGeral: stageName,
    status: stageName,
    ...(prospectData || {})
  });
  const normTarget = normalizeStageName(targetStage);

  const targetList = lists.find(l => normalizeStageName(l.name) === normTarget) || lists[0];
  if (!targetList) return;

  const title = prospectData?.clinicName || prospectData?.ownerName || 'Prospecto';
  const notes = prospectData?.fullAddress || prospectData?.location || prospectData?.imovel || prospectData?.notes || '';

  // Busca se já existe um dynamic_card para este prospecto
  const cardsQuery = query(
    collection(db, 'dynamic_cards'),
    where('sectorId', '==', 'prospeccao_followup'),
    where('clientId', '==', prospectId)
  );
  const snap = await getDocs(cardsQuery);

  if (!snap.empty) {
    for (const cardDoc of snap.docs) {
      await updateDoc(doc(db, 'dynamic_cards', cardDoc.id), {
        listId: targetList.id,
        title: title.trim(),
        notes: notes.trim(),
        updatedAt: Timestamp.now()
      });
    }
  } else {
    // Busca por título se não achar por clientId
    const allCardsSnap = await getDocs(
      query(collection(db, 'dynamic_cards'), where('sectorId', '==', 'prospeccao_followup'))
    );
    const matchByTitle = allCardsSnap.docs.find(d => {
      const c = d.data();
      return c.title && normalizeStageName(c.title) === normalizeStageName(title);
    });

    if (matchByTitle) {
      await updateDoc(doc(db, 'dynamic_cards', matchByTitle.id), {
        listId: targetList.id,
        clientId: prospectId,
        title: title.trim(),
        notes: notes.trim(),
        updatedAt: Timestamp.now()
      });
    } else {
      const cardsInList = allCardsSnap.docs.filter(d => d.data().listId === targetList.id);
      await addDoc(collection(db, 'dynamic_cards'), {
        sectorId: 'prospeccao_followup',
        listId: targetList.id,
        companyId,
        title: title.trim(),
        clientId: prospectId,
        type: 'client',
        order: cardsInList.length,
        notes: notes.trim(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    }
  }

  // Sincronizar flags com Prospecção Presencial (prospeccoes_docs)
  try {
    const pDocsSnap = await getDocs(
      query(collection(db, 'prospeccoes_docs'), where('clienteId', '==', prospectId))
    );
    for (const pDoc of pDocsSnap.docs) {
      if (normTarget === 'carta pronta') {
        await updateDoc(doc(db, 'prospeccoes_docs', pDoc.id), { isFinalizada: true, isEntregue: false });
      } else if (normTarget === 'carta entregue') {
        await updateDoc(doc(db, 'prospeccoes_docs', pDoc.id), { isEntregue: true });
      } else if (normTarget === 'cliente selecionado') {
        await updateDoc(doc(db, 'prospeccoes_docs', pDoc.id), { isFinalizada: false, isEntregue: false });
      }
    }
  } catch (err) {
    console.error('Erro ao atualizar prospeccoes_docs no sync:', err);
  }
}

/**
 * Sincroniza quando uma carta é finalizada ou entregue na Prospecção Presencial.
 * Move o card no Follow Up Kanban e atualiza o statusGeral do prospecto.
 */
export async function syncCartaProspeccaoToFollowup(
  cartaDocId: string,
  cartaData: any,
  newStatus: 'finalizada' | 'entregue' | 'ativa' | 'aguardando',
  companyId: CompanyType = 'digital'
): Promise<void> {
  const lists = await ensureFollowupListsInFirestore(companyId);

  let targetStage = 'Cliente Selecionado';
  if (newStatus === 'finalizada') {
    targetStage = 'Carta pronta';
  } else if (newStatus === 'entregue') {
    targetStage = 'Carta entregue';
  } else if (newStatus === 'ativa') {
    targetStage = 'Cliente Selecionado';
  }

  const normTarget = normalizeStageName(targetStage);
  const targetList = lists.find(l => normalizeStageName(l.name) === normTarget) || lists[0];
  if (!targetList) return;

  const prospectId = cartaData.clienteId || '';
  const title = cartaData.titulo || cartaData.clienteNome || 'Prospecção Presencial';
  const notes = cartaData.fullAddress || cartaData.imovel || cartaData.notes || '';

  // Atualizar o prospecto se existir
  if (prospectId) {
    try {
      const prospectUpdates: any = { statusGeral: targetStage };
      if (newStatus === 'entregue') {
        prospectUpdates.isEntregue = true;
      } else if (newStatus === 'finalizada') {
        prospectUpdates.isEntregue = false;
      } else if (newStatus === 'ativa') {
        prospectUpdates.isEntregue = false;
      }
      await updateDoc(doc(db, 'prospects', prospectId), prospectUpdates);
    } catch (err) {
      console.error('Erro ao atualizar prospecto a partir da carta:', err);
    }
  }

  // Localizar card dinâmico no setor prospeccao_followup
  const allCardsSnap = await getDocs(
    query(collection(db, 'dynamic_cards'), where('sectorId', '==', 'prospeccao_followup'))
  );

  const existingCard = allCardsSnap.docs.find(d => {
    const c = d.data();
    return (prospectId && c.clientId === prospectId) ||
           (cartaDocId && c.clientId === cartaDocId) ||
           (c.title && normalizeStageName(c.title) === normalizeStageName(title));
  });

  if (existingCard) {
    await updateDoc(doc(db, 'dynamic_cards', existingCard.id), {
      listId: targetList.id,
      title: title.trim(),
      clientId: prospectId || cartaDocId,
      notes: notes.trim(),
      updatedAt: Timestamp.now()
    });
  } else {
    const cardsInList = allCardsSnap.docs.filter(d => d.data().listId === targetList.id);
    await addDoc(collection(db, 'dynamic_cards'), {
      sectorId: 'prospeccao_followup',
      listId: targetList.id,
      companyId,
      title: title.trim(),
      clientId: prospectId || cartaDocId,
      type: 'client',
      order: cardsInList.length,
      notes: notes.trim(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  }
}

/**
 * Chamado quando o usuário move manualmente um card dentro do Follow Up Kanban.
 * Atualiza o nome dentro do botão suspenso (statusGeral) do prospecto vinculado
 * e sincroniza os estados de carta pronta/entregue.
 */
export async function syncFollowupCardMoved(
  card: any,
  targetList: any,
  _companyId: CompanyType = 'digital'
): Promise<void> {
  if (!card || !targetList || !targetList.name) return;

  const stageName = targetList.name.trim();
  const normStage = normalizeStageName(stageName);
  const clientId = card.clientId;

  let prospectFound = false;

  // 1. Tentar atualizar prospecto diretamente por clientId
  if (clientId) {
    try {
      const prospectRef = doc(db, 'prospects', clientId);
      const updates: any = {
        statusGeral: stageName,
        updatedAt: Timestamp.now()
      };

      if (normStage === 'carta entregue') {
        updates.isEntregue = true;
      } else if (normStage === 'carta pronta') {
        updates.isEntregue = false;
      } else if (normStage === 'cliente fechado') {
        updates.isContractClosed = true;
      } else if (normStage === 'cliente selecionado') {
        updates.isEntregue = false;
      }

      await updateDoc(prospectRef, updates);
      prospectFound = true;
    } catch (_) {
      // clientId pode ser de outro tipo (ex: prospeccoes_docs)
    }
  }

  // 2. Verificar vínculo com prospeccoes_docs
  try {
    let cartaDocId = '';
    let linkedProspectId = '';

    if (clientId) {
      const pDocSnap = await getDocs(
        query(collection(db, 'prospeccoes_docs'), where('clienteId', '==', clientId))
      );
      if (!pDocSnap.empty) {
        cartaDocId = pDocSnap.docs[0].id;
        linkedProspectId = clientId;
      } else {
        // Verificar se o clientId é o id de um prospeccoes_docs
        try {
          const directSnap = await getDocs(
            query(collection(db, 'prospeccoes_docs'), where('__name__', '==', clientId))
          );
          if (!directSnap.empty) {
            cartaDocId = directSnap.docs[0].id;
            linkedProspectId = directSnap.docs[0].data().clienteId || '';
          }
        } catch (_) {}
      }
    }

    if (!prospectFound && !linkedProspectId && card.title) {
      // Buscar prospecto por título
      const prospectsSnap = await getDocs(collection(db, 'prospects'));
      const found = prospectsSnap.docs.find(d => {
        const data = d.data();
        return (data.clinicName && normalizeStageName(data.clinicName) === normalizeStageName(card.title)) ||
               (data.ownerName && normalizeStageName(data.ownerName) === normalizeStageName(card.title));
      });
      if (found) {
        linkedProspectId = found.id;
        await updateDoc(doc(db, 'prospects', found.id), {
          statusGeral: stageName,
          ...(normStage === 'carta entregue' ? { isEntregue: true } : {}),
          ...(normStage === 'cliente fechado' ? { isContractClosed: true } : {})
        });
        prospectFound = true;
      }
    }

    // Se encontramos a carta vinculada, atualiza flags na carta
    if (cartaDocId) {
      const cartaUpdates: any = {};
      if (normStage === 'carta pronta') {
        cartaUpdates.isFinalizada = true;
        cartaUpdates.isEntregue = false;
        cartaUpdates.isAguardando = false;
      } else if (normStage === 'carta entregue') {
        cartaUpdates.isEntregue = true;
        cartaUpdates.isAguardando = false;
      } else if (normStage === 'cliente selecionado') {
        cartaUpdates.isFinalizada = false;
        cartaUpdates.isEntregue = false;
        cartaUpdates.isAguardando = false;
      }
      if (Object.keys(cartaUpdates).length > 0) {
        await updateDoc(doc(db, 'prospeccoes_docs', cartaDocId), cartaUpdates);
      }
    }

    // Se temos linkedProspectId e não atualizou ainda
    if (!prospectFound && linkedProspectId) {
      await updateDoc(doc(db, 'prospects', linkedProspectId), {
        statusGeral: stageName,
        ...(normStage === 'carta entregue' ? { isEntregue: true } : {}),
        ...(normStage === 'cliente fechado' ? { isContractClosed: true } : {})
      });
    }
  } catch (err) {
    console.error('Erro na sincronização pós-arrasto do card:', err);
  }
}

/**
 * Remove permanentemente duplicatas de dynamic_cards no setor prospeccao_followup no Firestore.
 * Mantém apenas 1 card por prospecto/cliente (priorizando o que tiver clientId real e dados mais completos).
 */
export async function deduplicateFollowupCardsInFirestore(): Promise<number> {
  try {
    const cardsQuery = query(
      collection(db, 'dynamic_cards'),
      where('sectorId', '==', 'prospeccao_followup')
    );
    const snap = await getDocs(cardsQuery);
    const cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const seenByClient = new Map<string, any>();
    const seenByTitle = new Map<string, any>();
    const toDelete: string[] = [];

    for (const card of cards as any[]) {
      if (card.deleted) continue;
      const normTitle = normalizeStageName(card.title || '');
      const cId = card.clientId;

      // Verificar duplicata por clientId
      if (cId && seenByClient.has(cId)) {
        toDelete.push(card.id);
        continue;
      }

      // Verificar duplicata por título normalizado
      if (normTitle && seenByTitle.has(normTitle)) {
        const prevCard = seenByTitle.get(normTitle);
        // Se o card anterior não tinha clientId ou era virtual e o atual tem clientId real
        if ((!prevCard.clientId || prevCard.clientId.startsWith('virtual-')) && cId && !cId.startsWith('virtual-')) {
          toDelete.push(prevCard.id);
          seenByTitle.set(normTitle, card);
          if (cId) seenByClient.set(cId, card);
        } else {
          toDelete.push(card.id);
        }
        continue;
      }

      if (cId) seenByClient.set(cId, card);
      if (normTitle) seenByTitle.set(normTitle, card);
    }

    if (toDelete.length > 0) {
      console.log(`[FollowUp Deduplication] Removendo ${toDelete.length} cards duplicados...`);
      for (const dupId of toDelete) {
        await deleteDoc(doc(db, 'dynamic_cards', dupId));
      }
    }

    return toDelete.length;
  } catch (error) {
    console.error('Erro ao deduplicar cards de followup:', error);
    return 0;
  }
}

/**
 * Restaura qualquer card de Follow Up que tenha sido acidentalmente marcado como concluído.
 */
export async function restoreCompletedFollowupCards(): Promise<number> {
  try {
    const q = query(
      collection(db, 'dynamic_cards'),
      where('sectorId', '==', 'prospeccao_followup'),
      where('completed', '==', true)
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    for (const d of snap.docs) {
      await updateDoc(doc(db, 'dynamic_cards', d.id), {
        completed: false,
        completedAt: null,
        updatedAt: Timestamp.now()
      });
    }
    console.log(`[FollowUp] Restaurados ${snap.docs.length} cards de followup concluídos.`);
    return snap.docs.length;
  } catch (err) {
    console.error('Erro ao restaurar cards de followup concluídos:', err);
    return 0;
  }
}

export async function syncFollowupCardsDirect(companyId: CompanyType = 'digital'): Promise<{ added: number; updated: number; total: number }> {
  // 0. Limpar duplicatas pré-existentes e restaurar concluídos acidentais
  await deduplicateFollowupCardsInFirestore();
  await restoreCompletedFollowupCards();

  // 1. Ensure 14 lists exist in Firestore
  const lists = await ensureFollowupListsInFirestore(companyId);

  const listMapByNormName: Record<string, any> = {};
  lists.forEach(l => {
    if (l.name) {
      listMapByNormName[normalizeStageName(l.name)] = l;
    }
  });

  const defaultList = lists[0];

  // 2. Fetch existing dynamic cards for prospeccao_followup
  const cardsQuery = query(
    collection(db, 'dynamic_cards'),
    where('sectorId', '==', 'prospeccao_followup')
  );
  const cardsSnap = await getDocs(cardsQuery);
  const existingCards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 3. Fetch all prospects
  const prospectsSnap = await getDocs(collection(db, 'prospects'));
  const prospects = prospectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 4. Fetch all prospeccoes_docs (cartas da prospecção presencial)
  const prospeccoesSnap = await getDocs(collection(db, 'prospeccoes_docs'));
  const prospeccoes = prospeccoesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 5. Fetch all clients
  const clientsSnap = await getDocs(collection(db, 'clients'));
  const clients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Indexar cartas por clienteId e por título/clínica para vínculo 100% unilateral
  const cartaByClientId: Record<string, any> = {};
  const cartaByNormTitle: Record<string, any> = {};

  for (const pr of prospeccoes as any[]) {
    if (pr.isDeleted) continue;
    if (pr.clienteId) {
      cartaByClientId[pr.clienteId] = pr;
    }
    const t = pr.titulo || pr.clienteNome || '';
    if (t) {
      cartaByNormTitle[normalizeStageName(t)] = pr;
    }
  }

  let addedCount = 0;
  let updatedCount = 0;
  const processedKeys = new Set<string>();

  const processRecord = async (
    recordId: string,
    title: string,
    recordData: any,
    linkedCarta?: any
  ) => {
    if (!title || !title.trim()) return;

    const normTitle = normalizeStageName(title);
    const uniqueKey = recordId || normTitle;

    if (processedKeys.has(uniqueKey)) return;
    processedKeys.add(uniqueKey);

    // Determinar o estágio congruente considerando os dados da ficha e da carta
    const targetStageName = getFollowupTargetStageName(recordData, linkedCarta);
    const targetNormStage = normalizeStageName(targetStageName);
    const targetList = listMapByNormName[targetNormStage] || defaultList;

    if (!targetList) return;

    // Localizar card existente no Firestore
    const existingCard: any = existingCards.find((c: any) =>
      (recordId && c.clientId === recordId) ||
      (linkedCarta?.id && c.clientId === linkedCarta.id) ||
      (c.title && normalizeStageName(c.title) === normTitle)
    );

    const notes = recordData.fullAddress || recordData.location || recordData.imovel || recordData.notes || (linkedCarta ? (linkedCarta.fullAddress || linkedCarta.imovel || '') : '');

    if (existingCard) {
      const updates: any = {};
      if (existingCard.listId !== targetList.id) {
        updates.listId = targetList.id;
      }
      if (!existingCard.notes && notes) {
        updates.notes = notes;
      }
      // Sempre vincular o clientId ao ID real do prospecto
      if (recordId && existingCard.clientId !== recordId) {
        updates.clientId = recordId;
      }
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = Timestamp.now();
        await updateDoc(doc(db, 'dynamic_cards', existingCard.id), updates);
        existingCard.listId = targetList.id;
        updatedCount++;
      }
    } else {
      const cardsInList = existingCards.filter((c: any) => c.listId === targetList.id);
      const newCardData: any = {
        sectorId: 'prospeccao_followup',
        listId: targetList.id,
        companyId,
        title: title.trim(),
        clientId: recordId || '',
        type: 'client',
        order: cardsInList.length + addedCount,
        notes: notes,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      const newDocRef = await addDoc(collection(db, 'dynamic_cards'), newCardData);
      existingCards.push({ id: newDocRef.id, ...newCardData });
      addedCount++;
    }
  };

  // 1. Processar Prospects (Base principal - Fichas) com suas cartas associadas
  for (const p of prospects as any[]) {
    if (p.isDeleted || p.isArchived) continue;
    const title = p.clinicName || p.ownerName || 'Prospecto';
    const normTitle = normalizeStageName(title);
    const linkedCarta = cartaByClientId[p.id] || cartaByNormTitle[normTitle];
    await processRecord(p.id, title, p, linkedCarta);
  }

  // 2. Processar Cartas órfãs da Prospecção Presencial (caso não tenham prospect cadastrado)
  for (const pr of prospeccoes as any[]) {
    if (pr.isDeleted) continue;
    const title = pr.titulo || pr.clienteNome || 'Prospecção Presencial';
    const normTitle = normalizeStageName(title);
    if (!processedKeys.has(pr.id) && !processedKeys.has(normTitle)) {
      await processRecord(pr.clienteId || pr.id, title, pr, pr);
    }
  }

  // 3. Processar Clientes Base (Ativos vão para Cliente Fechado)
  for (const cl of clients as any[]) {
    if (cl.status === 'ativo') {
      const title = cl.name || 'Cliente';
      await processRecord(cl.id, title, { statusGeral: 'Cliente Fechado', isContractClosed: true });
    }
  }

  return {
    added: addedCount,
    updated: updatedCount,
    total: addedCount + updatedCount
  };
}

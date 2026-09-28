import { db } from '../firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
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

export function getFollowupTargetStageName(record: any): string {
  const status = (record.status || '').trim();
  const statusGeral = (record.statusGeral || '').trim();
  const normStatus = normalizeStageName(status);
  const normGeral = normalizeStageName(statusGeral);

  // 14. Cliente Fechado
  if (
    normGeral.includes('cliente fechado') ||
    normStatus.includes('cliente fechado') ||
    normGeral.includes('contrato fechado') ||
    normStatus.includes('contrato fechado') ||
    record.isContractClosed === true
  ) {
    return 'Cliente fechado';
  }

  // 8. Contato Encerrado / Contrato Encerrado
  if (
    normGeral.includes('encerrado') ||
    normStatus.includes('encerrado')
  ) {
    return 'Contato Encerrado';
  }

  // Pós Reunião Follow ups
  if (normStatus.includes('pos reuniao') || normStatus.includes('pos-reuniao')) {
    if (normStatus.includes('5')) return 'Pós reunião - 5 follow up';
    if (normStatus.includes('4')) return 'Pós reunião - 4 follow up';
    if (normStatus.includes('3')) return 'Pós reunião - 3 follow up';
    if (normStatus.includes('2')) return 'Pós reunião - 2 follow up';
    if (normStatus.includes('1')) return 'Pós reunião - 1 follow up';
  }

  // 7. Reunião Agendada
  if (normStatus.includes('reuniao agendada') || normGeral.includes('reuniao agendada')) {
    return 'Reunião Agendada';
  }

  // 6. 3 follow up
  if (normStatus.includes('3 follow') || normStatus.includes('3º follow') || normStatus.includes('3+ follow')) {
    return '3 follow up';
  }

  // 5. 2 follow up
  if (normStatus.includes('2 follow') || normStatus.includes('2º follow')) {
    return '2 follow up';
  }

  // 4. 1 follow up
  if (normStatus.includes('1 follow') || normStatus.includes('1º follow')) {
    return '1 Follow up';
  }

  // 3. Carta entregue
  if (record.isEntregue === true || normStatus.includes('carta entregue') || normStatus === 'entregue') {
    return 'Carta entregue';
  }

  // 2. Carta pronta
  if (record.isFinalizada === true || normStatus.includes('carta pronta')) {
    return 'Carta pronta';
  }

  // 1. Cliente Selecionado (Padrão)
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

  return existingLists.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function syncFollowupCardsDirect(companyId: CompanyType = 'digital'): Promise<{ added: number; updated: number; total: number }> {
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

  // 4. Fetch all prospeccoes_docs
  const prospeccoesSnap = await getDocs(collection(db, 'prospeccoes_docs'));
  const prospeccoes = prospeccoesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 5. Fetch all clients
  const clientsSnap = await getDocs(collection(db, 'clients'));
  const clients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  let addedCount = 0;
  let updatedCount = 0;

  const processedKeys = new Set<string>();

  const processRecord = async (
    recordId: string,
    title: string,
    recordData: any,
    clientRefId?: string
  ) => {
    if (!title || !title.trim()) return;

    const normTitle = normalizeStageName(title);
    const uniqueKey = recordId || clientRefId || normTitle;

    if (processedKeys.has(uniqueKey)) return;
    processedKeys.add(uniqueKey);

    const targetStageName = getFollowupTargetStageName(recordData);
    const targetNormStage = normalizeStageName(targetStageName);
    const targetList = listMapByNormName[targetNormStage] || defaultList;

    if (!targetList) return;

    const existingCard: any = existingCards.find((c: any) =>
      (recordId && c.clientId === recordId) ||
      (clientRefId && c.clientId === clientRefId) ||
      (c.title && normalizeStageName(c.title) === normTitle)
    );

    if (existingCard) {
      if (existingCard.listId !== targetList.id) {
        await updateDoc(doc(db, 'dynamic_cards', existingCard.id), {
          listId: targetList.id,
          updatedAt: Timestamp.now()
        });
        updatedCount++;
      }
    } else {
      const cardsInList = existingCards.filter((c: any) => c.listId === targetList.id);
      await addDoc(collection(db, 'dynamic_cards'), {
        sectorId: 'prospeccao_followup',
        listId: targetList.id,
        companyId,
        title: title.trim(),
        clientId: recordId || clientRefId || '',
        type: 'client',
        order: cardsInList.length + addedCount,
        notes: recordData.fullAddress || recordData.location || recordData.imovel || recordData.notes || '',
        createdAt: Timestamp.now()
      });
      addedCount++;
    }
  };

  // Process Prospeccoes Presenciais Docs
  for (const pr of prospeccoes) {
    if (pr.isDeleted) continue;
    const title = pr.titulo || pr.clienteNome || 'Prospecção Presencial';
    await processRecord(pr.id, title, pr, pr.clienteId);
  }

  // Process Prospects
  for (const p of prospects) {
    if (p.isDeleted || p.isArchived) continue;
    const title = p.clinicName || p.ownerName || 'Prospect';
    await processRecord(p.id, title, p);
  }

  // Process Base Clients
  for (const cl of clients) {
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

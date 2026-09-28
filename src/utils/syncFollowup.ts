import { addDynamicCard, updateDynamicCard } from '../services/firestoreService';
import { Prospect, EditorProspeccaoDoc, Client, CompanyType } from '../types';

export function getFollowupTargetStageName(record: {
  status?: string;
  statusGeral?: string;
  isFinalizada?: boolean;
  isEntregue?: boolean;
  isAguardando?: boolean;
  hasPresencialFicha?: boolean;
  isInPerson?: boolean;
  isContractClosed?: boolean;
}): string {
  const status = (record.status || '').trim();
  const statusGeral = (record.statusGeral || '').trim();

  // 14. Cliente Fechado
  if (
    statusGeral === 'Cliente Fechado' ||
    status === 'Cliente Fechado' ||
    status === 'Cliente fechado' ||
    statusGeral === 'Cliente fechado' ||
    record.isContractClosed === true
  ) {
    return 'Cliente fechado';
  }

  // 8. Contato Encerrado / Contrato Encerrado
  if (
    statusGeral === 'Contrato Encerrado' ||
    status === 'Contrato Encerrado' ||
    status === 'Contato Encerrado' ||
    statusGeral === 'Contato Encerrado'
  ) {
    return 'Contato Encerrado';
  }

  // Pós Reunião Follow ups
  if (status.toLowerCase().includes('pós reunião') || status.toLowerCase().includes('pos reuniao')) {
    if (status.includes('5')) return 'Pós reunião - 5 follow up';
    if (status.includes('4')) return 'Pós reunião - 4 follow up';
    if (status.includes('3')) return 'Pós reunião - 3 follow up';
    if (status.includes('2')) return 'Pós reunião - 2 follow up';
    if (status.includes('1')) return 'Pós reunião - 1 follow up';
  }

  // 7. Reunião Agendada
  if (status === 'Reunião Agendada' || statusGeral === 'Reunião Agendada') {
    return 'Reunião Agendada';
  }

  // 6. 3 follow up
  if (
    status === '3º+ Follow Up' ||
    status === '3º Follow Up' ||
    status === '3 Follow up' ||
    status === '3 follow up'
  ) {
    return '3 follow up';
  }

  // 5. 2 follow up
  if (
    status === '2º Follow Up' ||
    status === '2 Follow up' ||
    status === '2 follow up'
  ) {
    return '2 follow up';
  }

  // 4. 1 follow up
  if (
    status === '1º Follow Up' ||
    status === '1 Follow up' ||
    status === '1 follow up'
  ) {
    return '1 Follow up';
  }

  // 3. Carta entregue
  if (record.isEntregue === true || status === 'Carta entregue' || status === 'Entregue') {
    return 'Carta entregue';
  }

  // 2. Carta pronta
  if (record.isFinalizada === true || status === 'Carta pronta') {
    return 'Carta pronta';
  }

  // 1. Cliente Selecionado (Padrão)
  return 'Cliente Selecionado';
}

export async function syncFollowupCards(params: {
  lists: any[];
  cards: any[];
  prospects: Prospect[];
  prospeccoes: EditorProspeccaoDoc[];
  clients: Client[];
  companyId: CompanyType;
}): Promise<number> {
  const { lists, cards, prospects, prospeccoes, clients, companyId } = params;
  if (!lists || lists.length === 0) return 0;

  const listMapByStageName: Record<string, any> = {};
  lists.forEach(l => {
    if (l.name) {
      listMapByStageName[l.name.trim()] = l;
    }
  });

  const defaultList = lists[0];
  let syncCount = 0;

  const processRecord = async (
    recordId: string,
    title: string,
    recordData: any,
    clientRefId?: string
  ) => {
    if (!title || !title.trim()) return;

    const targetStageName = getFollowupTargetStageName(recordData);
    const targetList = listMapByStageName[targetStageName] || defaultList;

    if (!targetList) return;

    const existingCard = cards.find(
      c =>
        (recordId && c.clientId === recordId) ||
        (clientRefId && c.clientId === clientRefId) ||
        (c.title && c.title.trim().toLowerCase() === title.trim().toLowerCase())
    );

    if (existingCard) {
      if (existingCard.listId !== targetList.id) {
        await updateDynamicCard(existingCard.id, { listId: targetList.id });
        syncCount++;
      }
    } else {
      const cardsInList = cards.filter(c => c.listId === targetList.id);
      await addDynamicCard({
        sectorId: 'prospeccao_followup',
        listId: targetList.id,
        companyId,
        title: title.trim(),
        clientId: recordId || clientRefId || '',
        type: 'client',
        order: cardsInList.length,
        notes: recordData.fullAddress || recordData.location || recordData.imovel || ''
      });
      syncCount++;
    }
  };

  // 1. Process Prospeccoes Presenciais
  for (const pr of prospeccoes) {
    if (pr.isDeleted) continue;
    const title = pr.titulo || pr.clienteNome || 'Prospecção Presencial';
    await processRecord(pr.id, title, pr, pr.clienteId);
  }

  // 2. Process Prospects
  for (const p of prospects) {
    if (p.isDeleted || p.isArchived) continue;
    const title = p.clinicName || p.ownerName || 'Prospect';
    await processRecord(p.id, title, p);
  }

  // 3. Process Base Clients
  for (const cl of clients) {
    if (cl.status === 'ativo') {
      const title = cl.name || 'Cliente';
      await processRecord(cl.id, title, { statusGeral: 'Cliente Fechado', isContractClosed: true });
    }
  }

  return syncCount;
}

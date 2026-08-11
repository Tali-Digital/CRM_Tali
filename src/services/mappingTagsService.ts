import { Prospect } from '../types';

export interface VariableTag {
  code: string;
  category: 'Geral & Empresa' | 'Notas & Desempenho' | 'SEO & Google Maps' | 'Site & Rastreamento' | 'Simulações & Anúncios' | 'IA & Resumos';
  description: string;
  isVisual?: boolean;
  exampleValue: (prospect?: Prospect | null, diagnosticData?: any) => string;
}

export const getFullKeywordTerm = (p?: Prospect | null, d?: any): string => {
  const kw = (p as any)?.keyword || d?.termoPesquisado || d?.gmn?.keyword || '';
  if (kw && kw.trim().length > 6 && kw.toLowerCase().includes(' em ')) {
    return kw.trim();
  }
  const loc = p?.location || p?.fullAddress || '';
  const city = loc ? loc.split('-')[0].trim() : '';
  if (city) {
    return `${kw.trim() || 'dentista'} em ${city}`;
  }
  return kw.trim() || 'dentista';
};

export const computeOportunidadesDetectadas = (diagnosticData?: any, formData?: any, prospect?: Prospect | null): string[] => {
  const list: string[] = [];
  const clinic = formData?.clinicName || prospect?.clinicName || (diagnosticData as any)?.nomeClinica || 'clínica';
  const kw = getFullKeywordTerm(prospect, diagnosticData);
  const city = formData?.cityName || prospect?.location?.split('-')[0]?.trim() || 'sua região';

  const d = diagnosticData || {};
  const anuncios = d.anuncios || {};
  const site = d.site || {};
  const gmn = d.gmn || {};

  // 1. Google Ads status
  const googleAdsActive = anuncios.clienteAnunciaGoogle === true || anuncios.googleAdsActive === true;
  if (!googleAdsActive) {
    list.push(`Ausência de campanha ativa no Google Ads para a palavra-chave "${kw}" (perda de clientes com intenção imediata de agendamento na região)`);
  } else {
    list.push(`Campanha ativa no Google Ads identificada, porém com margem para otimização de termos de busca focados em "${kw}"`);
  }

  // 2. Meta Ads (Instagram & Facebook) status
  const metaAdsActive = anuncios.clienteAnunciaMeta === true || anuncios.metaAdsActive === true;
  if (!metaAdsActive) {
    list.push(`Ausência de campanhas ativas de tráfego no Meta Ads (Instagram & Facebook) para captação local de novos pacientes`);
  } else {
    list.push(`Presença de anúncios no Meta Ads detectada, com oportunidade de escalar criativos de alta conversão em vídeo`);
  }

  // 3. Website & Speed
  const siteUrl = site.url || prospect?.site;
  const siteVel = typeof site.velocidade === 'number' ? site.velocidade : (parseInt(site.velocidade, 10) || null);
  if (!siteUrl) {
    list.push(`Site / Landing Page inexistente, impossibilitando a conversão de tráfego qualificado proveniente de pesquisas locais`);
  } else if (siteVel && siteVel < 50) {
    list.push(`Site com baixo desempenho de velocidade mobile (nota ${siteVel}/100 no Google PageSpeed), elevando a taxa de rejeição dos visitantes`);
  } else {
    list.push(`Oportunidade de otimização da taxa de conversão (CRO) da Landing Page com botão direto de WhatsApp`);
  }

  // 4. Google Maps positioning & invisibilty
  const foraTop20 = typeof gmn.foraTop20Percent === 'number' ? gmn.foraTop20Percent : (prospect?.percentForaTop20 ? parseInt(String(prospect.percentForaTop20), 10) : 50);
  const clientRank = Number(d.posicaoCliente ?? gmn.posicaoMedia ?? prospect?.posicaoMedia ?? 7);
  if (foraTop20 > 20 || clientRank > 3) {
    list.push(`Posicionamento irregular no Google Maps, ficando invisível em posição 20+ em cerca de ${foraTop20}% dos pontos analisados na região`);
  } else {
    list.push(`Posicionamento relevante no Google Maps, mas com necessidade de blindagem da liderança contra concorrentes diretos`);
  }

  // 5. Google Reviews volume
  const reviewsCount = prospect?.gmnReviewsCount ?? gmn.reviewsCount ?? d.reviewsCount ?? 0;
  const rating = prospect?.gmnRating || gmn.rating || '4.8';
  if (reviewsCount < 150) {
    list.push(`Boa nota no Google (${rating}★), porém com volume total de avaliações (${reviewsCount}) inferior aos principais concorrentes da região`);
  } else {
    list.push(`Excelente volume de avaliações (${reviewsCount} comentários), com oportunidade de implementar automação para coleta contínua`);
  }

  // 6. GMN profile optimization
  list.push(`Oportunidade de fortalecer a otimização SEO e inclusão da palavra-chave "${kw}" na categoria e descrição do perfil no Google Meu Negócio`);

  // 7. Rastreamento e Métrica de Conversão
  const hasPixel = site.pixelMeta === true || site.pixelGoogle === true;
  if (!hasPixel) {
    list.push(`Ausência de ferramentas de rastreamento de conversão (Pixel do Meta / Google Tag Manager) para medir cliques reais no WhatsApp`);
  } else {
    list.push(`Necessidade de auditoria no rastreamento de conversões para garantir atribuição correta dos leads captados`);
  }

  // 8. Resposta a Avaliações no Google
  list.push(`Oportunidade de responder 100% das avaliações no perfil do Google utilizando palavras-chave estratégicas para engajar o algoritmo`);

  // 9. Presença e Posicionamento nas Redes Sociais
  list.push(`Oportunidade de estruturar um calendário estratégico de conteúdos educativos e provas sociais nas redes sociais da ${clinic}`);

  // 10. Funil de Captação e Atendimento Rápido
  list.push(`Possibilidade de estruturar um funil de captação acelerado com atendimento de WhatsApp padronizado para converter buscas por "${kw}" em ${city}`);

  return list.slice(0, 10);
};

export const DEFAULT_VARIABLE_TAGS: VariableTag[] = [
  // IA & Resumos
  {
    code: '{{IA_PONTOS_OPORTUNIDADE}}',
    category: 'IA & Resumos',
    description: 'Insere a lista formatada em texto de pontos fracos e oportunidades da clínica',
    exampleValue: (p, d) => {
      const list = (Array.isArray(d?.oportunidadesDetectadas) && d.oportunidadesDetectadas.length > 0)
        ? d.oportunidadesDetectadas
        : computeOportunidadesDetectadas(d, {}, p);
      if (!list.length) return '';
      return `<ul style="padding-left: 20px; line-height: 1.6; color: #334155; margin: 12px 0;">${list.map((item: string) => `<li style="margin-bottom: 8px;">${item};</li>`).join('')}</ul>`;
    }
  },
  {
    code: '{{IA_OPORTUNIDADES}}',
    category: 'IA & Resumos',
    description: 'Alias de {{IA_PONTOS_OPORTUNIDADE}} - Lista em texto dos pontos de melhoria da clínica',
    exampleValue: (p, d) => {
      const list = (Array.isArray(d?.oportunidadesDetectadas) && d.oportunidadesDetectadas.length > 0)
        ? d.oportunidadesDetectadas
        : computeOportunidadesDetectadas(d, {}, p);
      if (!list.length) return '';
      return `<ul style="padding-left: 20px; line-height: 1.6; color: #334155; margin: 12px 0;">${list.map((item: string) => `<li style="margin-bottom: 8px;">${item};</li>`).join('')}</ul>`;
    }
  },
  // Geral & Empresa
  {
    code: '{{NOME_CLINICA}}',
    category: 'Geral & Empresa',
    description: 'Nome completo da clínica ou empresa prospectada',
    exampleValue: (p) => p?.clinicName || 'Clínica Odontológica Exemplo'
  },
  {
    code: '{{NOME_DONO}}',
    category: 'Geral & Empresa',
    description: 'Nome do proprietário, fundador ou sócio administrador',
    exampleValue: (p) => p?.ownerName || 'Dr. Marina Sales'
  },
  {
    code: '{{CNPJ}}',
    category: 'Geral & Empresa',
    description: 'Número do CNPJ da clínica (formatado)',
    exampleValue: (p) => p?.cnpj || '05.575.976/0001-06'
  },
  {
    code: '{{CIDADE}}',
    category: 'Geral & Empresa',
    description: 'Cidade ou bairro/região da clínica',
    exampleValue: (p) => p?.location || 'Brasília - DF (Asa Norte)'
  },
  {
    code: '{{ENDERECO}}',
    category: 'Geral & Empresa',
    description: 'Endereço completo da clínica',
    exampleValue: (p) => p?.fullAddress || p?.location || 'St. Sudoeste SQSW 301 - Brasília, DF'
  },
  {
    code: '{{INSTAGRAM}}',
    category: 'Geral & Empresa',
    description: 'Link oficial ou handle do Instagram da clínica',
    exampleValue: (p) => p?.clinicInstagram || 'https://instagram.com/ortoriso'
  },
  {
    code: '{{WEBSITE}}',
    category: 'Geral & Empresa',
    description: 'URL do site oficial ou Landing Page da clínica',
    exampleValue: (p) => p?.site || 'https://www.ortoriso.com.br'
  },

  // Notas & Desempenho
  {
    code: '{{NOTA_GERAL}}',
    category: 'Notas & Desempenho',
    description: 'Pontuação geral de presença digital (0 a 100)',
    exampleValue: (p, d) => d?.notaGeral ? `${d.notaGeral}/100` : '65/100'
  },
  {
    code: '{{RATING_GOOGLE}}',
    category: 'Notas & Desempenho',
    description: 'Nota de avaliações no Google (ex: 4.7 estrelas)',
    exampleValue: (p) => p?.gmnRating ? `${p.gmnRating} ★` : '4.7 ★'
  },
  {
    code: '{{REVIEWS_COUNT}}',
    category: 'Notas & Desempenho',
    description: 'Quantidade total de avaliações no Google Meu Negócio',
    exampleValue: (p) => p?.gmnReviewsCount ? `${p.gmnReviewsCount} avaliações` : '552 avaliações'
  },
  {
    code: '{{SCORE_GOOGLE}}',
    category: 'Notas & Desempenho',
    description: 'Pontuação do pilar Google Meu Negócio (0 a 100)',
    exampleValue: (p, d) => d?.placar?.google ? `${d.placar.google}/100` : '21/100'
  },
  {
    code: '{{SCORE_REPUTACAO}}',
    category: 'Notas & Desempenho',
    description: 'Pontuação do pilar Reputação e Avaliações (0 a 100)',
    exampleValue: (p, d) => d?.placar?.reputacao ? `${d.placar.reputacao}/100` : '92/100'
  },
  {
    code: '{{SCORE_INSTAGRAM}}',
    category: 'Notas & Desempenho',
    description: 'Pontuação do pilar Redes Sociais / Instagram (0 a 100)',
    exampleValue: (p, d) => d?.placar?.instagram ? `${d.placar.instagram}/100` : '60/100'
  },
  {
    code: '{{SCORE_SITE}}',
    category: 'Notas & Desempenho',
    description: 'Pontuação do pilar Site & Landing Page (0 a 100)',
    exampleValue: (p, d) => d?.placar?.site ? `${d.placar.site}/100` : '42/100'
  },
  {
    code: '{{SCORE_ADS}}',
    category: 'Notas & Desempenho',
    description: 'Pontuação do pilar Anúncios Google & Meta (0 a 100)',
    exampleValue: (p, d) => d?.placar?.ads ? `${d.placar.ads}/100` : '100/100'
  },

  // SEO & Google Maps
  {
    code: '{{POSICAO_MEDIA}}',
    category: 'SEO & Google Maps',
    description: 'Posição média da clínica no mapa de busca local',
    exampleValue: (p) => '12.55º lugar no mapa'
  },
  {
    code: '{{PERCENT_TOP3}}',
    category: 'SEO & Google Maps',
    description: 'Porcentagem dos pontos da região onde a clínica está no Top 3',
    exampleValue: (p) => '0%'
  },
  {
    code: '{{PERCENT_FORA_TOP20}}',
    category: 'SEO & Google Maps',
    description: 'Porcentagem de áreas da região onde a clínica fica invisível (Fora do Top 20)',
    exampleValue: (p) => '56%'
  },
  {
    code: '{{SOLV_PERCENT}}',
    category: 'SEO & Google Maps',
    description: 'Share of Local Voice (SoLV) - Participação de mercado local',
    exampleValue: (p) => '38.78%'
  },
  {
    code: '{{TERMO_PESQUISADO}}',
    category: 'SEO & Google Maps',
    description: 'Palavra-chave ou termo pesquisado na região (ex: "dentista em Valparaíso")',
    exampleValue: (p, d) => getFullKeywordTerm(p, d)
  },
  {
    code: '{{TERMO_BUSCA}}',
    category: 'SEO & Google Maps',
    description: 'Palavra-chave analisada na região (ex: "Dentista em Valparaíso")',
    exampleValue: (p, d) => getFullKeywordTerm(p, d)
  },
  {
    code: '{{NOMES_CONCORRENTES}}',
    category: 'SEO & Google Maps',
    description: 'Lista formatada em texto com o nome dos concorrentes diretos da região',
    exampleValue: (p, d) => d?.concorrentes && d.concorrentes.length > 0
      ? d.concorrentes.map((c: any) => c.nome).join(', ')
      : 'Odonto Premier - Dentista Lago Sul, Blanc Odontologia e Conic Odontologia'
  },
  {
    code: '{{POSICAO_GERAL}}',
    category: 'SEO & Google Maps',
    description: 'Posição aproximada da clínica no ranking geral (ex: 7ª posição)',
    exampleValue: (p, d) => d?.posicaoGeral ? `${d.posicaoGeral}ª posição` : '7ª posição'
  },
  {
    code: '{{PONTOS_PRESENCA}}',
    category: 'SEO & Google Maps',
    description: 'Quantidade de pontos da malha onde a clínica aparece (ex: 19 pontos do mapa)',
    exampleValue: (p, d) => d?.pontosPresenca ? `${d.pontosPresenca} pontos do mapa` : '19 pontos do mapa'
  },
  {
    code: '{{PERCENT_RESULTADOS}}',
    category: 'SEO & Google Maps',
    description: 'Porcentagem de presença calculada nos resultados analisados (ex: 38,78%)',
    exampleValue: (p, d) => d?.solvPercent ? `${d.solvPercent}%` : '38,78%'
  },
  {
    code: '{{POSICAO_FORA_TOP20_TEXTO}}',
    category: 'SEO & Google Maps',
    description: 'Indicador de pontos onde a clínica está invisível (ex: 20+)',
    exampleValue: () => '20+'
  },
  {
    code: '{{TEXTO_POSICAO_MAPA}}',
    category: 'SEO & Google Maps',
    description: 'Texto dinâmico sobre ranqueamento e pontos 20+ no Google Maps',
    exampleValue: (p, d) => `Presença irregular no Google Maps, com pontos em posição ${d?.gmn?.percentForaTop20 ? `${d.gmn.percentForaTop20} em 20+` : '20+'}`
  },
  {
    code: '{{TEXTO_CONCORRENTES}}',
    category: 'SEO & Google Maps',
    description: 'Texto dinâmico sobre presença de concorrentes diretos',
    exampleValue: (p) => `Concorrentes diretos aparecendo à frente da ${p?.clinicName || 'clínica'} em regiões estratégicas`
  },
  {
    code: '{{TEXTO_AVALIACOES}}',
    category: 'Notas & Desempenho',
    description: 'Texto dinâmico comparativo de nota e quantidade de avaliações',
    exampleValue: (p) => `Boa nota de ${p?.gmnRating || '4.8'}★ no Google, mas com volume de avaliações (${p?.gmnReviewsCount || 0}) menor que os concorrentes`
  },
  {
    code: '{{TEXTO_OPORTUNIDADE_GMN}}',
    category: 'SEO & Google Maps',
    description: 'Texto dinâmico de oportunidade de fortalecimento do perfil no Google',
    exampleValue: (p) => `Oportunidade de fortalecer o perfil da ${p?.clinicName || 'clínica'} no Google Meu Negócio para melhorar o ranqueamento local`
  },
  {
    code: '{{TEXTO_CAPTACAO_PACIENTES}}',
    category: 'Simulações & Anúncios',
    description: 'Texto dinâmico de oportunidade de captação de clientes na região',
    exampleValue: (p, d) => `Possibilidade de aumentar a captação de clientes que pesquisam por "${getFullKeywordTerm(p, d)}" na região`
  },
  {
    code: '{{IA_CARD_BUSCA_GOOGLE}}',
    category: 'SEO & Google Maps',
    description: 'Insere o cabeçalho completo com a legenda (Top 3, 4-10, 11+), termo buscado e cartão da clínica',
    exampleValue: () => '[Cartão de Busca no Google Maps com Legenda e Ficha da Clínica]'
  },
  {
    code: '{{IA_CARD_LEGENDA_MAPA}}',
    category: 'SEO & Google Maps',
    description: 'Insere a barra com legenda de posições (Top 3, 4-10, 11+) e busca no Google Maps',
    exampleValue: () => '[Legenda de Posições e Busca no Google Maps]'
  },
  {
    code: '{{IA_MAPA_CALOR}}',
    category: 'SEO & Google Maps',
    description: 'Insere a imagem real do mapa da varredura do Local Falcon',
    exampleValue: () => '[Imagem real do mapa Local Falcon]'
  },
  {
    code: '{{IA_FICHA_CLINICA}}',
    category: 'Geral & Empresa',
    description: 'Insere o cartão visual com nome, endereço, nota e avaliações da clínica',
    exampleValue: () => '[Cartão visual da clínica]'
  },
  {
    code: '{{IA_PLACAR_PILARES}}',
    category: 'Notas & Desempenho',
    description: 'Insere o placar visual dos pilares Google, Reputação, Instagram, Site e Ads',
    exampleValue: () => '[Placar visual por pilar]'
  },
  {
    code: '{{IA_RANKING_CONCORRENTES}}',
    category: 'SEO & Google Maps',
    description: 'Insere o ranking visual de concorrentes e a posição da clínica',
    exampleValue: () => '[Ranking visual de concorrentes]'
  },
  {
    code: '{{IA_PAGESPEED}}',
    category: 'Site & Rastreamento',
    description: 'Insere o painel visual de desempenho do site no Google PageSpeed',
    exampleValue: () => '[Painel visual do PageSpeed]'
  },
  {
    code: '{{IA_DINHEIRO_NA_MESA}}',
    category: 'Simulações & Anúncios',
    description: 'Insere o painel visual de estimativa de receita perdida',
    exampleValue: () => '[Painel visual de dinheiro na mesa]'
  },

  // Site & Rastreamento
  {
    code: '{{PERFORMANCE_PAGESPEED}}',
    category: 'Site & Rastreamento',
    description: 'Nota oficial de velocidade do Google PageSpeed (0 a 100)',
    exampleValue: (p, d) => d?.site?.velocidade ? `${d.site.velocidade}/100` : '83/100'
  },
  {
    code: '{{SEO_PAGESPEED}}',
    category: 'Site & Rastreamento',
    description: 'Nota técnica de SEO no Google PageSpeed (0 a 100)',
    exampleValue: (p, d) => d?.site?.seo !== undefined ? `${d.site.seo}/100` : '0/100'
  },
  {
    code: '{{PIXEL_META_STATUS}}',
    category: 'Site & Rastreamento',
    description: 'Status da presença do Pixel do Meta no site',
    exampleValue: (p, d) => d?.site?.pixelMeta ? 'Instalado ✅' : 'Ausente ❌'
  },
  {
    code: '{{GA4_STATUS}}',
    category: 'Site & Rastreamento',
    description: 'Status da presença do Google Analytics 4 (GA4) / Tag Manager',
    exampleValue: (p, d) => d?.site?.gtm ? 'Instalado ✅' : 'Ausente ❌'
  },

  // Simulações & Financeiro
  {
    code: '{{DINHEIRO_MESA_CONSERVADOR}}',
    category: 'Simulações & Anúncios',
    description: 'Projeção mensal de faturamento perdido (Cenário Conservador)',
    exampleValue: (p) => 'R$ 15.000 / mês'
  },
  {
    code: '{{DINHEIRO_MESA_MODERADO}}',
    category: 'Simulações & Anúncios',
    description: 'Projeção mensal de faturamento perdido (Cenário Moderado)',
    exampleValue: (p) => 'R$ 30.000 / mês'
  },
  {
    code: '{{DINHEIRO_MESA_AGRESSIVO}}',
    category: 'Simulações & Anúncios',
    description: 'Projeção mensal de faturamento perdido (Cenário Agressivo)',
    exampleValue: (p) => 'R$ 45.000 / mês'
  },

  // IA & Resumos
  {
    code: '{{IA_RESUMO}}',
    category: 'IA & Resumos',
    description: 'Resumo executivo completo de 3 pontos gerado por Inteligência Artificial',
    exampleValue: (p, d) => d?.resumo1 ? `1. ${d.resumo1}\n2. ${d.resumo2}\n3. ${d.resumo3}` : 'Resumo executivo da IA...'
  },
  {
    code: '{{IA_PLANO_ACAO}}',
    category: 'IA & Resumos',
    description: 'Plano de ação prioritário de 30 dias gerado por IA',
    exampleValue: (p, d) => d?.planoAcao ? d.planoAcao.map((item: any, i: number) => `${i+1}. ${item.titulo}: ${item.descricao}`).join('\n') : 'Plano de 30 dias...'
  },
  {
    code: '{{IA_CONCORRENTES}}',
    category: 'IA & Resumos',
    description: 'Tabela formatada com os principais concorrentes da região',
    exampleValue: (p, d) => d?.concorrentes ? d.concorrentes.map((c: any) => `- ${c.nome} (${c.nota}★ | ${c.avaliacoes} avaliações)`).join('\n') : 'Lista de concorrentes...'
  }
];

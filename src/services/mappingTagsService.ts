import { Prospect } from '../types';

export interface VariableTag {
  code: string;
  category: 'Geral & Empresa' | 'Notas & Desempenho' | 'SEO & Google Maps' | 'Site & Rastreamento' | 'Simulações & Anúncios' | 'IA & Resumos';
  description: string;
  exampleValue: (prospect?: Prospect | null, diagnosticData?: any) => string;
}

export const DEFAULT_VARIABLE_TAGS: VariableTag[] = [
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
    description: 'Palavra-chave ou termo pesquisado na região (ex: "dentista")',
    exampleValue: (p, d) => (p as any)?.keyword || d?.termoPesquisado || 'dentista'
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
    code: '{{TERMO_BUSCA}}',
    category: 'SEO & Google Maps',
    description: 'Palavra-chave analisada na região (ex: "dentista em Asa Norte")',
    exampleValue: (p) => `dentista em ${p?.location?.split('-')[0]?.trim() || 'sua região'}`
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

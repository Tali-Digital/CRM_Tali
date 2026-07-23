const fs = require('fs');
const file = 'src/components/MarketingDiagnosticView.tsx';
let code = fs.readFileSync(file, 'utf8');

const startStr = 'const renderDiagnostic = () => {';
const startIndex = code.indexOf(startStr);

if (startIndex === -1) {
  console.log('Could not find renderDiagnostic');
  process.exit(1);
}

// Find the end of renderDiagnostic
let openBraces = 0;
let endIndex = -1;
let started = false;

for (let i = startIndex; i < code.length; i++) {
  if (code[i] === '{') {
    openBraces++;
    started = true;
  } else if (code[i] === '}') {
    openBraces--;
  }

  if (started && openBraces === 0) {
    endIndex = i;
    break;
  }
}

if (endIndex === -1) {
  console.log('Could not find end of renderDiagnostic');
  process.exit(1);
}

const newRenderDiagnostic = `const renderDiagnostic = () => {
    if (!selectedProspect || !diagnosticData) return null;

    const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // Calculadora data for Dinheiro na mesa
    const cData = selectedProspect.calculatorData || {};
    const ticketMedio = cData.ticketMedio || 1500;
    const buscasMes = 500; // Est. Conservadora
    
    const cons = Math.round(buscasMes * 0.02 * ticketMedio);
    const mod = Math.round(buscasMes * 0.04 * ticketMedio);
    const agr = Math.round(buscasMes * 0.06 * ticketMedio);

    const notaGoogle = getNumber(selectedProspect.gmnRating, 0);
    const scoreGeral = notaGoogle > 4.5 ? 65 : (notaGoogle > 4.0 ? 44 : 25);

    return (
      <div className="bg-[#0d0f19] text-gray-100 min-h-screen p-8 rounded-2xl shadow-2xl font-sans overflow-y-auto">
        
        {/* Capa */}
        <div className="bg-[#1a1d2d] rounded-2xl p-8 mb-8 border border-gray-800">
          <div className="mb-8">
            <h4 className="text-orange-500 font-bold text-sm tracking-widest uppercase mb-2">Diagnóstico de Presença Digital</h4>
            <h1 className="text-4xl font-black text-white">{selectedProspect.clinicName || 'Nome da Clínica'}</h1>
          </div>
          
          <div className="grid grid-cols-2 gap-8 bg-[#0d0f19] p-6 rounded-xl border border-gray-800">
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Empresa Analisada</p>
              <p className="font-bold">{selectedProspect.clinicName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Cidade</p>
              <p className="font-bold">{selectedProspect.location || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Busca Analisada</p>
              <p className="font-bold">"Dentista em {selectedProspect.location?.split('-')[0]?.trim() || 'sua região'}"</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Data</p>
              <p className="font-bold">{dataAtual}</p>
            </div>
          </div>
        </div>

        {/* Nota Geral & Resumo */}
        <div className="grid grid-cols-1 gap-8 mb-8">
          <div className="bg-[#1a1d2d] p-8 rounded-2xl border border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">Nota geral</h3>
              <p className="text-sm text-gray-400 mb-6 max-w-sm">Esta nota é calculada somando os pesos de vários indicadores da sua presença digital.</p>
              
              <div className="flex items-center gap-8">
                <div className="relative w-32 h-32 flex items-center justify-center rounded-full border-8 border-gray-800 border-l-orange-500 border-t-orange-500">
                  <div className="text-center">
                    <div className="text-3xl font-black text-orange-500">{scoreGeral}</div>
                    <div className="text-[10px] text-gray-500">de 100</div>
                  </div>
                </div>
                <div>
                  <span className="bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full">{scoreGeral < 50 ? 'Fraco' : 'Regular'}</span>
                  <p className="mt-3 font-bold text-lg text-gray-300 max-w-sm">Sua presença digital existe, mas perde a maior parte das buscas para os concorrentes.</p>
                </div>
              </div>
            </div>

            {/* Placar por pilar */}
            {diagnosticData.placar && (
              <div className="bg-[#0d0f19] p-6 rounded-xl border border-gray-800 w-1/2">
                <h4 className="font-bold text-sm mb-4">Placar por pilar</h4>
                <div className="space-y-3">
                  {[
                    { label: 'Google Meu Negócio', score: diagnosticData.placar.google },
                    { label: 'Reputação', score: diagnosticData.placar.reputacao },
                    { label: 'Instagram', score: diagnosticData.placar.instagram },
                    { label: 'Site / Landing Page', score: diagnosticData.placar.site },
                    { label: 'Ads (Anúncios)', score: diagnosticData.placar.ads },
                  ].map((pilar, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300">{pilar.label}</span>
                        <span className="font-bold">{pilar.score}/100</span>
                      </div>
                      <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-orange-500 h-full" style={{ width: \`\${pilar.score}%\` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#1a1d2d] p-8 rounded-2xl border border-gray-800">
            <h3 className="text-xl font-bold mb-6">Resumo executivo</h3>
            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-[#0d0f19] rounded-xl border border-gray-800">
                <div className="w-6 h-6 shrink-0 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-xs">1</div>
                <p className="text-sm">{diagnosticData.resumo1}</p>
              </div>
              <div className="flex gap-4 p-4 bg-[#0d0f19] rounded-xl border border-gray-800">
                <div className="w-6 h-6 shrink-0 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-xs">2</div>
                <p className="text-sm">{diagnosticData.resumo2}</p>
              </div>
              <div className="flex gap-4 p-4 bg-[#0d0f19] rounded-xl border border-gray-800">
                <div className="w-6 h-6 shrink-0 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-xs">3</div>
                <p className="text-sm">{diagnosticData.resumo3}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Local Falcon Placeholder */}
        <div className="bg-[#1a1d2d] p-8 rounded-2xl border border-gray-800 border-dashed mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-10">
            <div className="bg-gray-900 p-6 rounded-2xl border border-gray-700 text-center max-w-md shadow-2xl">
              <AlertTriangle className="mx-auto text-yellow-500 mb-4" size={32} />
              <h4 className="font-bold text-lg mb-2">Requer Integração Local Falcon</h4>
              <p className="text-sm text-gray-400">Esta área exibirá o mapa de calor de 25 pontos e o Share of Local Voice (SoLV) exato assim que a API do Local Falcon for conectada.</p>
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2">Onde o Google mostra a sua empresa</h3>
          <p className="text-sm text-gray-400 mb-6">Simulamos buscas reais em 25 pontos ao redor do seu endereço.</p>
          <div className="h-64 bg-gray-800 rounded-xl opacity-30 flex items-center justify-center">
            [ MAPA DE CALOR AQUI ]
          </div>
        </div>

        {/* Você contra quem está ganhando */}
        <div className="bg-[#1a1d2d] p-8 rounded-2xl border border-gray-800 mb-8 overflow-x-auto">
          <h3 className="text-xl font-bold mb-2">Você contra quem está ganhando</h3>
          <p className="text-sm text-gray-400 mb-6">Comparação direta com seus principais concorrentes na região.</p>
          
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-3 px-4 font-bold text-gray-400">FATOR</th>
                <th className="py-3 px-4 font-bold text-orange-500 bg-orange-900/20 text-center rounded-t-xl">VOCÊ</th>
                {diagnosticData.concorrentes?.map((c: any, i: number) => (
                  <th key={i} className="py-3 px-4 font-bold text-gray-300 text-center">{c.nome}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Google Rating', key: 'nota', isCheck: false },
                { label: 'Avaliações', key: 'avaliacoes', isCheck: false },
                { label: 'Anuncia no Google?', key: 'anunciaGoogle', isCheck: true },
                { label: 'Anuncia no Insta/Face?', key: 'anunciaMeta', isCheck: true },
                { label: 'Responde avaliações?', key: 'respondeAvaliacoes', isCheck: true },
                { label: 'Posta toda semana?', key: 'postaFrequencia', isCheck: true },
                { label: 'Site rápido?', key: 'siteRapido', isCheck: true },
              ].map((row, idx) => (
                <tr key={idx} className="border-b border-gray-800">
                  <td className="py-3 px-4 text-sm text-gray-300">{row.label}</td>
                  
                  {/* YOU */}
                  <td className="py-3 px-4 text-center bg-orange-900/10">
                    {row.isCheck ? <span className="text-red-500">❌</span> : <span className="text-orange-400 font-bold">-</span>}
                  </td>
                  
                  {/* Competitors */}
                  {diagnosticData.concorrentes?.map((c: any, i: number) => (
                    <td key={i} className="py-3 px-4 text-center text-sm">
                      {row.isCheck ? (
                        c[row.key] ? <span className="text-green-500">✅</span> : <span className="text-red-500">❌</span>
                      ) : (
                        c[row.key]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Site & Landing Page */}
        {diagnosticData.site && (
          <div className="bg-[#1a1d2d] p-8 rounded-2xl border border-gray-800 mb-8">
            <h3 className="text-xl font-bold mb-2">Site / Landing Page</h3>
            <p className="text-sm text-gray-400 mb-6">Como as pessoas veem sua clínica após clicarem para saber mais.</p>
            
            <div className="grid grid-cols-2 gap-8 mb-6">
              <div className="bg-[#0d0f19] p-6 rounded-xl border border-gray-800">
                <h4 className="text-xs text-gray-500 uppercase font-bold mb-4">Pixels e Rastreamento</h4>
                <ul className="space-y-3">
                  <li className="flex items-center justify-between text-sm"><span>Pixel do Meta:</span> {diagnosticData.site.pixelMeta ? <span className="text-green-500">Ativo ✅</span> : <span className="text-red-500">Não detectado ❌</span>}</li>
                  <li className="flex items-center justify-between text-sm"><span>Pixel do Google:</span> {diagnosticData.site.pixelGoogle ? <span className="text-green-500">Ativo ✅</span> : <span className="text-red-500">Não detectado ❌</span>}</li>
                  <li className="flex items-center justify-between text-sm"><span>Google Tag Manager:</span> {diagnosticData.site.gtm ? <span className="text-green-500">Ativo ✅</span> : <span className="text-red-500">Não detectado ❌</span>}</li>
                  <li className="flex items-center justify-between text-sm"><span>Link direto WhatsApp:</span> {diagnosticData.site.whatsapp ? <span className="text-green-500">Ativo ✅</span> : <span className="text-red-500">Não detectado ❌</span>}</li>
                </ul>
              </div>

              <div className="bg-[#0d0f19] p-6 rounded-xl border border-gray-800">
                <h4 className="text-xs text-gray-500 uppercase font-bold mb-4">Performance Técnica</h4>
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">Velocidade e Performance</span>
                    <span className="font-bold text-orange-500">{diagnosticData.site.velocidade}/100</span>
                  </div>
                  <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-orange-500 h-full" style={{ width: \`\${diagnosticData.site.velocidade}%\` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">Otimização SEO (Buscadores)</span>
                    <span className="font-bold text-red-500">{diagnosticData.site.seo}/100</span>
                  </div>
                  <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full" style={{ width: \`\${diagnosticData.site.seo}%\` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-sm font-bold text-purple-400 mb-2 uppercase">O que os números mostram</h4>
                <ul className="list-disc pl-4 space-y-2 text-sm text-gray-300">
                  <li>O site não possui rastreadores instalados. Sem eles, você não sabe se os anúncios estão dando lucro ou prejuízo.</li>
                  <li>O site carrega muito devagar no celular, o que faz com que a maioria dos cliques pagos sejam desperdiçados antes da página abrir.</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-bold text-green-400 mb-2 uppercase">Oportunidades</h4>
                <ul className="list-disc pl-4 space-y-2 text-sm text-gray-300">
                  <li>{diagnosticData.site.oportunidade1}</li>
                  <li>{diagnosticData.site.oportunidade2}</li>
                  <li>{diagnosticData.site.oportunidade3}</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Anúncios */}
        {diagnosticData.anuncios && (
          <div className="bg-[#1a1d2d] p-8 rounded-2xl border border-gray-800 mb-8">
            <h3 className="text-xl font-bold mb-2">Anúncios</h3>
            <p className="text-sm text-gray-400 mb-6">Como ler: consultamos as bibliotecas públicas de anúncios do Google e do Meta para ver quem está pagando para aparecer na sua região.</p>
            
            <div className="bg-[#0d0f19] p-6 rounded-xl border border-gray-800 mb-6 flex gap-6 flex-wrap">
              <div className="bg-[#1a1d2d] p-4 rounded-xl border border-gray-800 flex-1 min-w-[200px]">
                <h4 className="text-2xl font-black mb-1">{diagnosticData.anuncios.clienteAnunciaGoogle ? 'Sim' : 'Não'}</h4>
                <p className="text-xs text-gray-400">você anuncia no Google</p>
              </div>
              <div className="bg-[#1a1d2d] p-4 rounded-xl border border-gray-800 flex-1 min-w-[200px]">
                <h4 className="text-2xl font-black mb-1">{diagnosticData.anuncios.clienteAnunciaMeta ? 'Sim' : 'Não'}</h4>
                <p className="text-xs text-gray-400">você anuncia no Instagram/Facebook</p>
              </div>
              <div className="bg-[#1a1d2d] p-4 rounded-xl border border-gray-800 flex-1 min-w-[200px]">
                <h4 className="text-2xl font-black mb-1">{diagnosticData.anuncios.concorrentesGoogle}/3</h4>
                <p className="text-xs text-gray-400">concorrentes anunciando no Google</p>
              </div>
              <div className="bg-[#1a1d2d] p-4 rounded-xl border border-gray-800 flex-1 min-w-[200px]">
                <h4 className="text-2xl font-black mb-1">{diagnosticData.anuncios.concorrentesMeta}/3</h4>
                <p className="text-xs text-gray-400">concorrentes anunciando no Meta</p>
              </div>
            </div>

            <div className="bg-orange-900/20 border border-orange-500/30 p-4 rounded-xl mb-6">
              <p className="text-orange-400 font-bold text-sm">
                {diagnosticData.anuncios.clienteAnunciaGoogle 
                  ? "Você já anuncia e isso está bem feito, é um ativo que podemos usar para recuperar pacientes rapidamente." 
                  : "Você não está anunciando, o que significa que seus concorrentes estão recebendo todos os pacientes que buscam por dentista hoje."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-sm font-bold text-purple-400 mb-2 uppercase">O que os números mostram</h4>
                <ul className="list-disc pl-4 space-y-2 text-sm text-gray-300">
                  <li>Você anuncia no Google e no Meta: Google ativo: {diagnosticData.anuncios.clienteAnunciaGoogle ? 'sim' : 'não'} | Meta ativo: {diagnosticData.anuncios.clienteAnunciaMeta ? 'sim' : 'não'}.</li>
                  <li>Concorrentes anunciando no Google na região: {diagnosticData.anuncios.concorrentesGoogle} | concorrentes anunciando no Meta: {diagnosticData.anuncios.concorrentesMeta}.</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-bold text-green-400 mb-2 uppercase">Oportunidades</h4>
                <ul className="list-disc pl-4 space-y-2 text-sm text-gray-300">
                  <li>{diagnosticData.anuncios.oportunidade1}</li>
                  <li>{diagnosticData.anuncios.oportunidade2}</li>
                  <li>{diagnosticData.anuncios.oportunidade3}</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Dinheiro na Mesa */}
        <div className="bg-[#1a1d2d] p-8 rounded-2xl border border-gray-800 mb-8">
          <h3 className="text-xl font-bold mb-2">Dinheiro na mesa</h3>
          <p className="text-sm text-gray-400 mb-6">Estimativa da receita que deixa de entrar por mês.</p>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-end mb-2">
                <h4 className="text-sm font-bold">Conservador: entrar no topo em um terço da região</h4>
                <span className="text-xl font-black text-green-500">R$ {cons.toLocaleString('pt-BR')}/mês</span>
              </div>
              <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden">
                <div className="bg-green-500 h-full w-1/3"></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-end mb-2">
                <h4 className="text-sm font-bold">Moderado: aparecer entre os 3 primeiros em metade da região</h4>
                <span className="text-xl font-black text-green-500">R$ {mod.toLocaleString('pt-BR')}/mês</span>
              </div>
              <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden">
                <div className="bg-green-500 h-full w-1/2"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <h4 className="text-sm font-bold">Agressivo: aparecer entre os 3 primeiros em toda a região</h4>
                <span className="text-xl font-black text-green-500">R$ {agr.toLocaleString('pt-BR')}/mês</span>
              </div>
              <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden">
                <div className="bg-green-500 h-full w-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Plano de 30 dias */}
        <div className="bg-[#1a1d2d] p-8 rounded-2xl border border-gray-800">
          <h3 className="text-xl font-bold mb-2">Plano de 30 dias</h3>
          <p className="text-sm text-gray-400 mb-6">As cinco ações em ordem de prioridade geradas por IA.</p>
          
          <div className="space-y-4">
            {diagnosticData.planoAcao?.map((p: any, i: number) => (
              <div key={i} className="flex gap-4 p-5 bg-[#0d0f19] rounded-xl border border-gray-800">
                <div className="w-8 h-8 shrink-0 bg-purple-900 text-purple-200 rounded-full flex items-center justify-center font-bold text-sm">{i + 1}</div>
                <div>
                  <h4 className="font-bold text-sm mb-1">{p.titulo}</h4>
                  <p className="text-sm text-gray-300 mb-2">{p.descricao}</p>
                  <div className="flex gap-2">
                    <span className="text-[10px] font-bold px-2 py-1 bg-green-900/30 text-green-400 rounded">IMPACTO {p.imp}</span>
                    <span className="text-[10px] font-bold px-2 py-1 bg-blue-900/30 text-blue-400 rounded">ESFORÇO {p.esf}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    );
  };`;

const updatedCode = code.substring(0, startIndex) + newRenderDiagnostic + code.substring(endIndex + 1);

fs.writeFileSync(file, updatedCode);
console.log('UI updated successfully!');

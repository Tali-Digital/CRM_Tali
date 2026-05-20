const fs = require('fs');

const tsv = `Ordem	Responsável Talí	Cidade/Bairro - Estado	Nome Clínica	Instagram Clínica	GMN	Site	Nome Dono	Instagram Dono	Seguiu o dono?	Colaboradores	Tamanho	Idade	Nota / Qtd de Avaliações	Observações Importantes	Status	Resposta?	Último Follow up	Abordagem usada	Data 1º Contato	Semana
1	Diogo	Águas Claras - DF	Concept Odontologia	https://www.instagram.com/concept.clinica/	https://www.google.com/maps?cid=17107572292729933206	https://conceptclinica.com.br/	Wadson Almeida	https://www.instagram.com/wadson.santos.10/	Sim		1 Cadeira	5 anos	4,8 / 682		Mensagem Enviada	FALSE		v1	5-mai.-2026	Semana 1
2	Diogo	Águas Claras - DF	Odonto Aguas Claras	https://www.instagram.com/odontoaguasclaras/	https://www.google.com/maps?cid=10289450762552572900	https://www.odontoaguasclaras.com.br/	Carlos Eduardo Silva Vale, Heverton de Alencar Silva Ferreira, Mariana Barroso Coelho	https://www.instagram.com/marianab.coelho/	Sim		1 Cadeira	17 anos	4,9 / 225		Mensagem Enviada	FALSE		v2	20-mai.-2026	Semana 1
3	Diogo	Águas Claras - DF	Qualis Odontologia	https://www.instagram.com/qualisodonto/	https://www.google.com/maps?cid=3577241715842256808	https://qualisodonto.com.br/	Eduardo Franco	https://www.instagram.com/dreduardofranco/	Sim		1 Cadeira	5 anos	5,0 / 204		Mensagem Enviada	FALSE				Semana 1
4	Diogo	Águas Claras - DF	Clinica Odontológica Odontec	https://www.instagram.com/clinica.odontec/	https://www.google.com/maps/place/Cl%C3%ADnica+Odontol%C3%B3gica+Odontec/@-15.8338077,-48.0378024,17z/data=!3m1!4b1!4m6!3m5!1s0x935a3348fd37c5a7:0x3404dbe8bfc6a849!8m2!3d-15.8338077!4d-48.0378024!16s%2Fg%2F11px51gg3t?entry=ttu&g_ep=EgoyMDI2MDUwMi4wIKXMDSoASAFQAw%3D%3D	Não encontrado	RAFAEL ASSIS MARQUES, EDYLANE SANTOS ALVES	https://www.instagram.com/lanesantos26/ , https://www.instagram.com/rafassis92/	Solicitado		1 Cadeira	5 anos	4,9 / 550	Mensagem enviada para o Rafael, o perfil da Edylane é fechado	Mensagem Enviada	FALSE				Semana 1
5	Diogo	Águas Claras - DF	SouClinic	https://www.instagram.com/souclinic.ac/	https://www.google.com/maps?cid=8726339100314093995	https://karinevitoria.com.br/?utm_source=GoogleMeuNegocio	Karine Vitoria Monte Cardoso	https://www.instagram.com/dra.karinecardosov/	Sim		1 Cadeira	3 meses	4,9 / 472	Tem muitos colaboradores para o tamanho dela	Mensagem Enviada	FALSE				Semana 1
6	Diogo	Águas Claras - DF	Luna Odontologia	https://www.instagram.com/clinicalunaodontologia/	https://www.google.com/maps/place/Luna+Odontologia/@-15.8351167,-48.0120236,15z/data=!4m15!1m8!3m7!1s0x935a33d91ad83105:0xd0d97a046b6d30f2!2sLuna+Odontologia!8m2!3d-15.8351201!4d-48.0121682!10e5!16s%2Fg%2F11gwhg7wy6!3m5!1s0x935a33d91ad83105:0xd0d97a046b6d30f2!8m2!3d-15.8351201!4d-48.0121682!16s%2Fg%2F11gwhg7wy6?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D	https://www.lunaodonto.com.br/	Aletheya Patrice 	https://www.instagram.com/aletheya_luna/	Sim		1 Cadeira	8 anos	4,9 / 208	Aguardando ser aceito	Mandar mensagem	FALSE				Semana 2
7	Diogo	Águas Claras - DF	Ceorth Clínica Odontológica	https://www.instagram.com/ceorth_odontologia/	https://www.google.com/maps/place/CEORTH+CL%C3%8DNICA+ODONTOL%C3%93GICA/@-15.8367667,-48.0192754,17z/data=!3m1!4b1!4m6!3m5!1s0x935a32136b0d7aef:0xca1c7d001537a625!8m2!3d-15.8367667!4d-48.0192754!16s%2Fg%2F11b_2_khgx?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D	https://www.ceorth.com.br/	Dra Camila Andrade	https://www.instagram.com/dracamilandrade/	Sim	5 a 10	1 Cadeira	13 anos	4,9 / 185		Mensagem Enviada	FALSE				Semana 2
8	Diogo	Águas Claras - DF	IBA Odontologia Integrada	https://www.instagram.com/ibaodontologia/	https://www.google.com/maps/place/IBA+Odontologia+Integrada/@-15.8421109,-48.0243103,3a,77.4y,90t/data=!3m8!1e2!3m6!1sAF1QipPThiL7kbMpVX7OBSkIRe-S5BJOD-T8ZaQ36jhH!2e10!3e12!6shttps:%2F%2Flh3.googleusercontent.com%2Fp%2FAF1QipPThiL7kbMpVX7OBSkIRe-S5BJOD-T8ZaQ36jhH%3Dw203-h104-k-no!7i1278!8i658!4m7!3m6!1s0x935a335666d5929b:0xa2e75534ce742888!8m2!3d-15.8418255!4d-48.0236968!10e5!16s%2Fg%2F11q4bwpyn4?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D	https://ibaodontologia.com.br/	Julia Barros Alves, Laura Barros Alves	https://www.instagram.com/laurabarros.alves/ , https://www.instagram.com/drajuliabarros/	Sim	5 a 10	1 Cadeira	4 anos	5,0 / 146	Conhecida do Gabriel da AES	Mensagem Enviada	FALSE		Oi Fulano, tudo bem?		Semana 2
9	Diogo	Águas Claras - DF	Alfa Ridere Centro Odontológico	https://www.instagram.com/alfaridere/	https://www.google.com/maps/place/Alfa+Ridere+Dentista+em+%C3%81guas+Claras+%7C+Ortodontia+Implante+e+Lentes+Dent%C3%A1rias/@-15.8359607,-48.0115019,17z/data=!3m1!4b1!4m6!3m5!1s0x935a32109bff34ef:0x470a63ce64f1bd93!8m2!3d-15.8359607!4d-48.0115019!16s%2Fg%2F11b6_cx9lg?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D	-	Dr Mauro Henrique, Dra Lorena Gonçalves de Faria	https://www.instagram.com/drmaurogontijofaria/ , https://www.instagram.com/dralorenagontijo/ 	Sim	Até 5	1 Cadeira	12 anos	5,0 / 114		Mensagem Enviada	FALSE		Oi Fulano, tudo bem?		Semana 2
10	Diogo	Águas Claras - DF	Odontocenter Águas Claras	https://www.instagram.com/odontocenteraguasclaras/	https://www.google.com/maps/place/Odontocenter+%C3%81guas+Claras/@-15.8339637,-48.0149226,17z/data=!3m1!4b1!4m6!3m5!1s0x935a33d37bb1ca75:0xe2bbb393595b646a!8m2!3d-15.8339637!4d-48.0149226!16s%2Fg%2F11gmvcxl_v?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D	https://www.odontocenteracdf.com.br/	Carla Pereira de Sousa - Sócio-Administrador, Eliane Seito Freire Maia - Sócio, Patricia Rogerio Elias - Sócio	https://www.instagram.com/carla_odontocenter/	Sim	5 a 10	1 Cadeira	18 anos	4,9 / 155		Mensagem Enviada	FALSE		Oi Fulano, tudo bem?		Semana 2
11	Helenilton	Águas Claras - DF	Lírios Odontologia	https://www.instagram.com/dra.alineolive/	Lírios Odontologia - Dra. Aline Olive	https://draalineolive.com/	ALINE OLIVE DE ARAUJO JANUARIO	https://www.instagram.com/dra.alineolive/	Sim		1 Cadeira			- SEM SITE ATIVO, - Vídeo de Antes e depois muito bem pensado com imagem da pessoa e sorriso anterior no canto da tela	Mensagem Enviada	FALSE		V2	6-mai.-2026	Semana 2
12	Helenilton	Águas Claras - DF	Onne Odontologia	https://www.instagram.com/onneodontologia/	Onne Odontologia | Dentista Águas Claras | Implante Dentário Aparelho Invisível Invisalign	https://onneodontologia.net/	Dr Evandro Filho	https://www.instagram.com/evandroosternefilho/	Sim		1 Cadeira			Site pessimamente Ruim, feito no Wix	Mensagem Enviada	FALSE			6-mai.-2026	Semana 2
13	Helenilton	Águas Claras - DF	Atually Odontologia Especializada	https://www.instagram.com/atually.odontologia/	https://maps.google.com/?cid=15429181756021543609	https://atuallyodontologia.com.br/	BRUNA MOREIRA COELHO, JHYMES DE SOUZA RODRIGUES	https://www.instagram.com/dra.bruna_moreira?igsh=MTBkcWh5czVkdDZyMQ%3D%3D&utm_source=qr, https://www.instagram.com/dr.jhymes_rodrigues/	Sim		3+ Cadeiras 			Coloquei o Instagram dos dois Donos, segui os dois também, vai que com um deles da certo	Mensagem Enviada	FALSE			6-mai.-2026	Semana 2
14	Helenilton	Águas Claras - DF	Odonto Abreu Clínica Odontológica	https://www.instagram.com/clinicaodontoabreu/	https://maps.google.com/?cid=6525529241232235457	https://www.odontoabreu.com.br/	ANA PAULA DE ABREU	https://www.instagram.com/draanapaula_odontoabreu/	Sim		3+ Cadeiras 			- Site péssimo, aparentemente tem várias cadeiras na clínica, mas não vi os outros profissionais nem no site nem no instagram	Mensagem Enviada	FALSE			6-mai.-2026	Semana 2
15	Helenilton	Águas Claras - DF	Plena Clínica Odontológica	https://www.instagram.com/plena.clinicaodonto/	https://maps.google.com/?cid=16473019337197712508	https://plenaodonto.com/	POLIANA XAVIER	https://www.instagram.com/polianax.odp/	Sim		1 Cadeira			1 Cadeira só, parece pequena, voltada para crianças, Em dúvida sobre o ICP, mas vou entrar em contato	Mandar mensagem	FALSE			19-mai.-2026	Semana 1
16	Helenilton	Águas Claras - DF	Faces Odontologia	https://www.instagram.com/facesodontologia/	https://www.google.com/maps/place/Faces+Odontologia+Especializada+-+Lentes+de+Contato+Dental/@-15.8413189,-48.0231217,17z/data=!4m15!1m8!3m7!1s0x935a32727bd2a68b:0x324ae453e88d41c!2sFaces+Odontologia+Especializada+-+Lentes+de+Contato+Dental!8m2!3d-15.8413977!4d-48.0233!10e5!16s%2Fg%2F11dxl46nht!3m5!1s0x935a32727bd2a68b:0x324ae453e88d41c!8m2!3d-15.8413977!4d-48.0233!16s%2Fg%2F11dxl46nht?entry=ttu&g_ep=EgoyMDI2MDUwMi4wIKXMDSoASAFQAw%3D%3D	https://www.facesodontologia.com.br/in%C3%ADcio	Dra. Karina de Oliveira Sales da Cruz	https://www.instagram.com/drakarinacruz/	Sim		2 Cadeiras			GMN está legal, instagram e site da pra melhorar	Mensagem Enviada	FALSE			7-mai.-2026	Semana 2
18	Helenilton	Águas Claras - DF	COB - Centro Odontológico De Brasília	https://www.instagram.com/cob.odontologia/	https://maps.google.com/?cid=6409669711096750032	https://cobrasilia.com.br/	WALKIRIA MENDES DE LIMA CERBINO	https://www.instagram.com/dra.walkiria/	Sim		3+ Cadeiras 			Site não Carrega - 2 Unidades	Mensagem Enviada	FALSE			7-mai.-2026	Semana 2
19	Helenilton	Águas Claras - DF	IMP Odonto	https://www.instagram.com/impodonto/	https://maps.google.com/?cid=540869271782453575	http://impodonto.com.br/	RICARDO FABRIS PAULIN, LIANA BONFIM MISSON PAULIN	https://www.instagram.com/drricardopaulin/	Solicitado		3+ Cadeiras 			Ja tem Agência (https://insitemarketing.digital/)	Mandar mensagem	FALSE		Oi, Dr. Ricardo, tudo bem? Me chamo Helenilton Alves...	19-mai.-2026	Semana 1
20	Helenilton	Águas Claras - DF	OdontoMed Clinica Odontologica	https://www.instagram.com/odontomed_df/	https://maps.google.com/?cid=16175309161409557498	NÃO TEM	BARBARA CAROLINE PEDROZA TENORIO	https://www.instagram.com/dra.barbaractenorio/	Sim		3+ Cadeiras 			Tentar pelo Facebook também: https://www.facebook.com/DraBarbaratenorio/	Mensagem Enviada	FALSE			7-mai.-2026	Semana 2
21	Helenilton	Águas Claras - DF	Patrícia Pizzo Clínica Odontológica	https://www.instagram.com/odontopatriciapizzo/	https://maps.google.com/?cid=9944486686592341465	http://www.patriciapizzo.com.br/	PATRICIA MARIA PIZZO REIS	https://www.instagram.com/odontopatriciapizzo/	Sim		3+ Cadeiras 				Mensagem Enviada	FALSE			7-mai.-2026	Semana 2
22	Helenilton	Águas Claras - DF	SCury Odontologia	https://www.instagram.com/scuryodontologia/	https://maps.google.com/?cid=12964385716841226767	http://scuryodontologia.com.br/	STEFANNY CURY GUERRA VASCONCELOS	https://www.instagram.com/tetycury/	Solicitado		3+ Cadeiras 				Mandar mensagem	FALSE			7-mai.-2026	Semana 2
23	Helenilton	Águas Claras - DF	Orthos Odontologia	https://www.instagram.com/orthosbrasilia	https://maps.google.com/?cid=17602167728930593026	https://orthosodonto.com.br/	Dra Mariella Salgado	https://www.instagram.com/dra.mariellasalgado	Solicitado		3+ Cadeiras 			Site fora do ar. Segui o Welss e o Sérgio Marra	Mandar mensagem	FALSE			19-mai.-2026	Semana 1
24	Helenilton	Águas Claras - DF	harmonizare odontologia	https://www.instagram.com/p/C4_QFoqpjup/	https://www.google.com/maps/place/Harmonizare+Odontologia./@-15.7431803,-47.9024719,17z/data=!3m1!4b1!4m6!3m5!1s0x935a3a309ad6b9b7:0x398084b5a6eaa74a!8m2!3d-15.7431803!4d-47.9024719!16s%2Fg%2F11c5h2_dd6?hl=pt-BR&entry=ttu&g_ep=EgoyMDI2MDUxNy4wIKXMDSoASAFQAw%3D%3D	https://www.harmonizare.com/	João Henrique	https://www.instagram.com/drjoaohenriquerosa/	Sim		2 Cadeiras				Mandar mensagem	FALSE			19-mai.-2026	Semana 1
25	Helenilton	Águas Claras - DF	Perioclinic	https://www.instagram.com/perioclinicodontologiaa/	https://maps.google.com/?cid=4081078317850022728	http://odontologiaperioclinic.com.br/	SAMARA SILVA TOMAZ	https://www.instagram.com/drasamaratomaz/	Sim		2 Cadeiras			Site Fora do Ar	Mandar mensagem	FALSE			19-mai.-2026	Semana 1
26	Helenilton	Águas Claras - DF	Guiotti Galvão Odontologia - Dentista em Águas Claras	https://www.instagram.com/guiottigalvao/	https://maps.google.com/?cid=10607495656419104780	https://guiottigalvao.com.br/	ADRIANO GUIOTTI GALVAO, JOVELINO FERREIRA GALVAO								Mandar mensagem	FALSE			19-mai.-2026	Semana 1
28	Helenilton	Águas Claras - DF	Onne Odontologia	https://www.instagram.com/onneodontologia/	https://maps.google.com/?cid=9231454741253015599	https://onneodontologia.net/	HELEN DE MELO SANTOS OSTERNE								VERIFICAR	FALSE			20-mai.-2026	Semana 1
29	Helenilton	Águas Claras - DF	Vital Odontologia e Saúde	https://www.instagram.com/vital_odonto_saude/	https://maps.google.com/?cid=406867147876303350	https://instagram.com/vital_odonto_saude?igshid=wetn0hqt7oxn	FLAVIA MAYUMI KOMENO ENDRES, THIAGO ENDRES DA SILVA GOMES								VERIFICAR	FALSE			20-mai.-2026	Semana 1
30	Helenilton	Águas Claras - DF	Ampla Odontologia	https://www.instagram.com/ampla_odontologia/	https://maps.google.com/?cid=9965070652727543755		BIANCA DE SANTI BONATTI OLIVEIRA, THIAGO AMARAL DE OLIVEIRA								VERIFICAR	FALSE			20-mai.-2026	Semana 1
31	Helenilton	Águas Claras - DF	Clínica Odontológica Sorriso Aberto	https://www.instagram.com/sorriso.aberto/	https://maps.google.com/?cid=11651250230918435552		GILBERTO MINORU SHIMANO								VERIFICAR	FALSE			20-mai.-2026	Semana 1
32	Helenilton	Águas Claras - DF	OdontoZ	https://www.instagram.com/odontoz/	https://maps.google.com/?cid=11468393895107961725	https://www.odontoz.com.br/	ZACARIAS SILVA CONDE, VINICIUS SILVA CONDE								VERIFICAR	FALSE			20-mai.-2026	Semana 1`;

const lines = tsv.split('\n').slice(1);
const output = [];

for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    if (parts.length < 21) continue;
    
    if (!parts[3] && !parts[1]) continue;

    output.push({
        order: parseInt(parts[0]) || 0,
        responsible: parts[1] || '',
        location: parts[2] || '',
        clinicName: parts[3] || '',
        clinicInstagram: parts[4] || '',
        gmn: parts[5] || '',
        site: parts[6] || '',
        ownerName: parts[7] || '',
        ownerInstagram: parts[8] || '',
        followedOwner: parts[9] || '',
        collaborators: parts[10] || '',
        size: parts[11] || '',
        age: parts[12] || '',
        gmnRating: parts[13] || '',
        observations: parts[14] || '',
        status: parts[15] || '',
        hasAnswered: parts[16] === 'TRUE' || parts[16] === 'Sim',
        lastFollowUp: parts[17] || '',
        approachUsed: parts[18] || '',
        firstContactDate: parts[19] || '',
        week: parts[20] || '',
        currentStep: 1
    });
}

let code = `const data = [\n`;
for (const item of output) {
    code += `      { `;
    for (const [k, v] of Object.entries(item)) {
        if (typeof v === 'string') {
            code += `${k}: '${v.replace(/'/g, "\\'")}', `;
        } else {
            code += `${k}: ${v}, `;
        }
    }
    code += `},\n`;
}
code += `    ];`;

fs.writeFileSync("d:\\\\- - - - Antigravit Projetos\\\\CRM_Tali\\\\scratch\\\\data_code.txt", code);
console.log("Done!");

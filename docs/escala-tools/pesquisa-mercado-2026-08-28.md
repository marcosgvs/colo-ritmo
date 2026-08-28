# Pesquisa · Como o mundo faz escala médica

> Varredura de 28/08/2026 (10 agentes de pesquisa web, 226 buscas) para desenhar o ciclo
> automatizado de novembro. Contexto e conclusões consolidadas em
> `docs/escala-hcb-referencia.md` e na memória `novembro-automacao`.


## 1 · Brasil (produtos + Senior HCM)

**Resumo.** O mercado brasileiro de escala médica (Escala App/Einstein, Pega Plantão, Soffia/ex-Plantão Ativo, DoctorID) converge no mesmo desenho: gestor monta a escala numa plataforma web, o médico recebe/troca plantão pelo app com validação automática de regras, e a "integração com folha" na prática é RELATÓRIO no formato do RH — nem o líder Escala App faz API com folha CLT. Para o nosso caso específico (OSS + CLT + Senior HCM), a resposta à pergunta-chave é SIM: dá para lançar escala pronta no Senior sem digitação manual — na linha G5/Vetorh existe o web service SOAP `programacaoColetiva` com portas `Horario` e `Escala` (exatamente o que o RH digita hoje na tela Programações Coletivas), e no senior X existe o Integrador X que importa CSV em lote com validação e log. O caminho de menor atrito pro próximo mês não é app novo: é gerar o export no layout exato que o RH já processa (matrícula + data + código de horário) e, em paralelo, propor ao RH o teste do canal automático (WS ou CSV). As regras CLT que os produtos implementam (interjornada 11h art. 66, 12x36 com DSR embutido via art. 59-A, adicional noturno com hora reduzida e prorrogação pós-5h, turno cruzando meia-noite) coincidem com o nosso validador — os pontos que o mercado lista como erros clássicos de ponto são justamente os que já monitoramos.

### Senior HCM (G5/Vetorh) tem web service que lança escala/troca de horário em lote — sem digitação

O web service SOAP `com.senior.g5.rh.hr.programacaoColetiva` do módulo CP (Controle de Ponto) expõe 14 portas, entre elas `Horario` (troca de horário) e `Escala` (atribuição de escala), além de `HoraExtra`, `Compensacao`, `Convocacao` e `SobreAvisoProntidao`. Recebe `numEmp` (empresa), `tipOpe` (I=inclusão, E=exclusão), parâmetros de abrangência de colaboradores (matrículas) e datas; executa síncrono, assíncrono ou agendado, devolvendo `erroExecucao` por registro. É a versão programática exata da tela que o RH usa manualmente.

*Fonte: https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/webservices/com_senior_g5_rh_hr_programacaocoletiva.htm*

**Aplicação no HCB:** Se o HCB roda a linha G5 (Rubi/Vetorh/Ronda), nosso script Python pode gerar as chamadas SOAP com os mesmos códigos numéricos que hoje a escalista manda pro RH digitar — eliminando a digitação. Primeiro passo: perguntar ao RH qual linha/versão do Senior usam e se o WS está habilitado.

### A tela Programações Coletivas é o que o RH faz hoje com nossos códigos — e define o layout do nosso export

Na tela Programações Coletivas do Ronda, o RH filtra colaboradores, informa o código do 'Novo Horário' e um intervalo de datas, e o sistema gera um registro de troca de horário por dia. Aceita troca de horário, troca de escala, ponte, compensação e autorização de extras, tudo em grupo. Ou seja: o insumo mínimo é (matrícula, data, código de horário cadastrado).

*Fonte: https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/ronda/frprgcol.htm*

**Aplicação no HCB:** Nosso export de 'códigos pro RH' deve espelhar exatamente essa tripla (matrícula × data × código) na ordem que a tela pede — vira copy/paste trivial pro RH mesmo sem integração, e é o mesmo dataset que alimentaria o WS depois. Vale validar com o RH quais códigos de horário estão cadastrados para cada turno (M/T/N) antes de fechar novembro.

### senior X: Integrador X importa CSV em lote com validação e log (mas é pro cadastro-base, não pro dia-a-dia)

A tela Importação de dados (Gestão de Pessoas | HCM > Cadastros gerais > Integrador X) aceita apenas CSV com cabeçalhos do modelo, por fluxo: 'Cadastro de Escalas' (código 1-999, tipo permanente/definida/geração automática), depois 'Horários de Escala', 'Escalas do Ponto' e 'Horários'. Cada fluxo tem layout próprio, validações (obrigatoriedade, formato DD/MM/AAAA, integridade referencial) e log de inconsistências para reimportação. A troca de horário do colaborador (o movimento diário) entra por fluxo de movimentação/programação, não por esse cadastro.

*Fonte: https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/hcm/cadastros-gerais/integrador-x/importacao-dados/*

**Aplicação no HCB:** Distinção importante pro nosso plano: 'escala' no Senior é o template de jornada (cadastro), e o plantão real de cada médico em cada dia é 'programação de troca de horário'. Nosso gerador deve produzir o segundo. Se o HCB estiver no senior X, o caminho em lote existe igualmente (CSV), com log de erro linha a linha — bom para auditar rejeições.

### Escala App (Einstein): escala-base replicável + troca com auto-aprovação validada por regra

Nascido da inovação do Einstein (2016), hoje ~130 mil usuários em ~300 instituições. Mecânica: cria-se uma escala-base e replica-se pelo período; publicação automática no app de cada profissional com atualização em tempo real; limites de horas mensais/semanais configuráveis; o gestor pode delegar a aprovação de trocas ao sistema — se a troca não infringe nenhuma restrição configurada, a ferramenta aprova sozinha. O produto 'Jornadas' é configurado com CLT e normas sindicais, alertando ou bloqueando erros antes da publicação (ex.: valida interjornada de 11h ao montar 12x36).

*Fonte: https://escala.app/blog/hospital-israelita-albert-einstein-escala/ e https://escala.app/blog/aplicativos-de-plantao-medico/*

**Aplicação no HCB:** Valida nossa arquitetura (validador CLT que roda ANTES de publicar) e aponta o próximo degrau de automação: troca self-service entre médicos com aprovação automática quando o validador passa — encaixa direto no app React/Supabase com drag-and-drop que já temos, e tira a escalista do meio das trocas rotineiras.

### Nem o líder integra com folha por API: a 'integração' do Escala App é extrato em 3 níveis no formato do RH

O Escala App declara funcionar 'não importa qual seja o sistema de folha' e resolve o fechamento com o painel financeiro: (1) analítico por turno (entrada/saída que justificam cada valor), (2) consolidado por equipe (total de horas, valor somado, plantões publicados), (3) consolidado por profissional (horas trabalhadas e valor a receber). Captura planejado vs trabalhado via check-in/check-out geolocalizado, com bônus configuráveis para noturno/horas mistas/fim de semana. Não há menção a API com Senior/TOTVS.

*Fonte: https://escala.app/blog/sistema-de-folha-de-pagamento/*

**Aplicação no HCB:** Confirma que nossa estratégia (gerar códigos/planilha no formato que o RH do HCB já conhece) é o padrão de mercado, não uma gambiarra. A decisão 'planilha inteligente vs app' não precisa esperar integração de folha — o export certo já é o estado da arte; o WS do Senior seria ir ALÉM do mercado.

### Pega Plantão: pagamento '1 clique' e integração com ERPs hospitalares (Tasy, SoulMV) — não com folha CLT

Gestor monta a escala na nuvem; profissionais veem agenda, trocam plantões, recebem anúncios de cobertura e registram presença pelo app com envio de documentação. No fim do mês o gestor gera relatórios de pagamentos, produtividade e faltas 'com 1 clique', com integração declarada a sistemas de pagamento hospitalar de grande porte como Tasy e SoulMV.

*Fonte: https://www.pegaplantao.com.br/ e https://www.pegaplantao.com.br/gestao-de-escalas-plantoes*

**Aplicação no HCB:** Mostra que quando o mercado integra, integra com o ERP hospitalar (pagamento de plantão avulso/PJ), não com folha CLT via Senior — o nosso cenário (66 CLT numa OSS com Senior HCM) é o caso menos servido pelos produtos prontos, o que reforça manter a solução própria em vez de contratar um app de mercado que não fala com o Senior.

### Plantão Ativo virou Soffia: formalização de troca com trilha dupla (app + e-mail) como padrão

Plataforma com ~170 mil profissionais em ~2.000 unidades de saúde. O gestor de escala atribui a escala mensal de cada membro e edita quando preciso; trocas de plantão são formalizadas instantaneamente no app E por e-mail (mais de 1 milhão de trocas processadas); check-in/check-out no próprio app; relatórios por profissional e por setor com confirmação de presença, total de horas e valores. Escalas organizadas por grupo/setor independente da entidade de saúde.

*Fonte: https://soffia.co/ e https://www.plantaoativo.com/about*

**Aplicação no HCB:** O padrão do mercado para troca é: registro estruturado + notificação formal por e-mail (trilha de auditoria pro RH/OSS). Como no HCB 'troca é fluxo normal', vale copiar essa mecânica: troca registrada no sistema gera automaticamente o e-mail formal que hoje se faz à mão, e o diff da escala já sai pronto pro re-export dos códigos ao Senior.

### DoctorID: o produto mais parecido com o nosso contexto (hospitais, OSS, terceirizadas CLT+PJ) — e mesmo assim sem ponte com folha

Focado em hospitais, OSS e empresas terceirizadas de saúde: geração de escala médica, revezamentos, trocas, substituições, oferta de vagas e controle de indisponibilidade; ponto por GPS/QR Code/biometria conforme módulo; folha de ponto eletrônica individualizada com relatórios de horas, folha e previsão de custo mensal; fechamento financeiro com apuração de horas/valores/produtividade, repasses, CNAB e gestão de notas. A página não menciona nenhuma integração com Senior, TOTVS, MV ou Tasy — a OSS presta contas a órgãos de fiscalização com esses relatórios.

*Fonte: https://www.doctorid.com.br/software-gestao-de-plantao-medico*

**Aplicação no HCB:** Dois aprendizados: (1) o gap escala→folha CLT existe até nos produtos feitos pra OSS, então resolver isso com o export Senior é diferencial real, não retrabalho; (2) o par 'indisponibilidade estruturada' + 'oferta de vaga/cobertura' é a versão-produto do nosso problema de preferências por e-mail livre — formulário estruturado de disponibilidade é o que todos fazem.

### As regras CLT que os produtos implementam batem com nosso validador — com 2 armadilhas de ponto a conferir

O consenso implementado: interjornada mínima de 11h (art. 66 CLT) validada na montagem; 12x36 via art. 59-A com DSR e feriados já embutidos na remuneração mensal (feriado não paga em dobro quando a 12x36 é formalizada); adicional noturno de 22h-5h com hora reduzida de 52min30s e prorrogação do adicional após as 5h quando a jornada avança (Súmula 60); e os erros clássicos de sistemas de ponto: turno que cruza a meia-noite registrado como dois dias separados, e troca de plantão sem formalização que quebra o espelho de ponto.

*Fonte: https://www.pontotel.com.br/escala-12x36/ e https://escala.app/escala-de-trabalho/escala-12x36/*

**Aplicação no HCB:** Checklist direto pro nosso validador de novembro: (1) o plantão N que cruza meia-noite deve contar como UM turno na data de início (nosso export de códigos precisa casar com como o Senior trata isso); (2) a pendência N→T com só 6h de intervalo é exatamente violação do art. 66 — os produtos bloqueiam isso por default; (3) prorrogação noturna pós-5h é conta do ponto/folha (Senior), não da escala — não precisamos calcular, só não gerar sequências que a tornem irregular.

### TOTVS RM e o padrão geral: importação em lote existe em todos os grandes de folha

O TOTVS RM (Automação de Ponto) importa batidas em lote com agendamento automático via integração Clockin/Carol (desde a versão 12.1.29), inclui DSR conforme a escala de trabalho cadastrada e integra automaticamente com o módulo Folha de Pagamento; há processos de importação de lançamentos em geral e banco de horas. Ou seja, o padrão dos ERPs de RH brasileiros (Senior, TOTVS) é aceitar carga em lote — planilha/CSV/arquivo ou serviço — para tudo que hoje se digita.

*Fonte: https://centraldeatendimento.totvs.com/hc/pt-br/articles/4427635287319-RH-RM-PTO-Importa%C3%A7%C3%A3o-autom%C3%A1tica-de-batidas-com-integra%C3%A7%C3%A3o-via-Clockin-Carol*

**Aplicação no HCB:** Se um dia o HCB trocar de ERP (OSS trocam de sistema quando troca o contrato de gestão), o desenho 'gerador de arquivo no layout do ERP' sobrevive — basta trocar o template de saída. Mais um argumento pra manter o dataset canônico da escala no nosso lado (planilha/Supabase) e tratar o ERP como destino de exportação.

**Recomendações desta lente:**

- Perguntar ao RH do HCB qual linha do Senior usam (G5/Rubi/Vetorh/Ronda vs senior X): se G5, propor piloto do web service programacaoColetiva (portas Horario/Escala) alimentado pelo nosso script Python; se senior X, piloto de CSV via Integrador X. Em ambos, o dataset é o mesmo que já geramos (matrícula × data × código de horário).
- Enquanto o canal automático não é aprovado, formatar o export de códigos EXATAMENTE na ordem da tela Programações Coletivas (filtro de colaboradores → código 'Novo Horário' → intervalo de datas), reduzindo o trabalho do RH a conferência — e pedir ao RH a lista oficial de códigos de horário cadastrados por turno para eliminar erro de de/para.
- Substituir o e-mail livre de preferências por formulário estruturado (disponibilidade/indisponibilidade por dia+turno) — é o padrão de TODOS os produtos analisados; pode ser uma aba da própria planilha ou uma tela simples no app existente, e o parser de e-mail vira fallback.
- Implementar troca self-service com auto-aprovação condicionada ao validador CLT (padrão Escala App): troca que não viola interjornada/cota/cobertura é aprovada sozinha, registrada com trilha (app + e-mail formal, padrão Soffia), e dispara o re-export do diff de códigos pro Senior.
- Não condicionar a decisão 'planilha vs app' à integração com folha: nenhum produto de mercado integra escala médica com folha CLT por API — relatório/arquivo no formato do RH é o estado da arte, e o WS do Senior nos colocaria à frente do mercado com esforço pequeno.
- No validador de novembro, garantir: turno noturno que cruza meia-noite contado como um único plantão na data de início (casando com o tratamento do Senior), bloqueio default de sequências com interjornada <11h (art. 66 — o caso N→T de 6h pendente), e lembrar que 12x36 formalizada embute DSR e feriado (art. 59-A) — prorrogação de adicional noturno é conta da folha, não da escala.


## 2 · Processo e self-scheduling

**Resumo.** O que separa ciclo de escala sem briga de ciclo caótico não é a ferramenta, é o desenho do processo: calendário fixo e público (form de pedidos com prazo, montagem, escala preliminar com janela de revisão datada, congelamento, só então trocas), regras de prioridade escritas e conhecidas por todos, e um livro-razão de créditos/débitos que transforma "quem levou o turno ruim" em número auditável. Os casos reais convergem em quatro mecânicas: (1) turnos obrigatórios/indesejáveis são alocados PRIMEIRO e as preferências depois — exatamente a ordem fds→feriado→semana que já usamos; (2) pedido tem limite e tem tipo (garantido vs desejado) — pedido ilimitado em texto livre é o que gera a sensação de loteria; (3) quem cobre buraco ganha crédito formal compensado no ciclo seguinte (call break), quem larga plantão fica devendo ao pool; (4) troca pós-publicação é fluxo normal, mas só após a versão final, combinada entre os dois médicos primeiro, registrada num canal único e validada contra as regras — a escalista é aprovadora, não corretora. O experimento de self-scheduling do MIT/Brigham mostra o modo de falha número 1: quando a folha permite se inscrever em turno já cheio ou pedir mais do que a cota, o gestor precisa remanejar na mão, o remanejado se sente traído e o sistema colapsa — o que é um argumento direto para formulário estruturado com validação em tempo real (app ou planilha protegida) em vez de e-mail livre.

### Ciclo completo documentado: manual do Call Committee da residência de psiquiatria da Univ. de Washington

Processo real, escrito e público: (1) formulário de pedidos (Call Request Form) é enviado 1-2 semanas antes de abrir, com 3 semanas para preencher e prazo duro anunciado ('due Thursday 10/9'); quem não tem preferência PRECISA entregar o form mesmo assim, e vacations/licenças devem ser marcadas no form 'mesmo que você já tenha avisado alguém'. (2) Meta: fechar toda a montagem pelo menos 6 semanas antes da escala entrar em vigor. (3) Escala preliminar é publicada com checklist do que cada um deve conferir (ex.: 'confira que você não está de plantão na semana de backup') e DEADLINE de revisão datado ('Friday November 14 at 5pm'); é proibido trocar antes da versão final ('DO NOT TRADE ANY CALLS UNTIL THE CALL SCHEDULE IS FINALIZED'). (4) Livro-razão de créditos: quem pega plantão extra (voluntário ou sorteado) recebe 'call break' no ciclo seguinte; quem aciona o backup fica devendo um plantão inteiro; registros de calls owed / call breaks / feriados são mantidos entre ciclos. (5) Buraco imprevisto: primeiro voluntários (sabendo que ganham crédito), depois LOTERIA entre elegíveis. (6) Grávidas não recebem plantão nas 4 semanas antes do parto. (7) Mudança de regra exige voto de 2/3 da residência — regra é da equipe, não do escalista.

*Fonte: https://depts.washington.edu/psychres/wordpress/wp-content/uploads/2017/09/call_committee_users_manual.pdf*

**Aplicação no HCB:** É o molde mais próximo do nosso caso: dá para copiar quase literalmente o calendário (form abre ~6 semanas antes do mês, 3 semanas para responder, preliminar com janela de revisão de ~1 semana e checklist do que conferir, congelamento antes de liberar trocas) e o livro-razão de créditos — que já fazemos informalmente com os carry-overs de outubro, mas sem nome nem visibilidade. Publicar 'calls owed / créditos' junto com a escala do HCB formalizaria o que a planilha v4 já calcula.

### Ordem de montagem validada: obrigatório/indesejável primeiro, preferência depois

Guias de scheduling de residência (QGenda, Lightning Bolt) recomendam explicitamente alocar primeiro os turnos obrigatórios e menos desejáveis — porque isso permite distribuí-los de forma comprovadamente justa antes que as preferências consumam os graus de liberdade — e trabalhar o cronograma de trás pra frente a partir da data de publicação (data final → aprovação da chefia → buffer de montagem → prazo dos pedidos). O manual da UW segue a mesma lógica na prática: semanas de backup primeiro, depois feriados (começando pela classe mais restrita), depois residentes com pedidos/rotações mais complicados, e por último os casos fáceis. Transparência sobre quais turnos são considerados indesejáveis e como foram distribuídos reduz reclamação pós-publicação.

*Fonte: https://www.qgenda.com/blog/tips-tricks-for-resident-scheduling/*

**Aplicação no HCB:** Valida cientificamente a DICA que já registramos (fds primeiro e mais justo → feriado → semana). O ganho novo é o cronograma reverso explícito: fixar a data de publicação da escala de novembro e derivar dela o prazo do formulário, e publicar junto com a escala um mini-relatório de como os turnos ruins foram distribuídos (contagem de fds/noites por médico) — transforma a defesa da escala de discussão em consulta.

### Modo de falha nº 1 do self-scheduling: inscrição sem validação vira entitlement (caso MIT/Brigham & Women's, UTI com 70 enfermeiras)

Estudo de caso de 1 ano numa unidade de 70 RNs: o sign-up em papel deixava enfermeiras se inscreverem em turnos já cheios, pegarem mais turnos que sua carga ou sequências dia+noite inválidas; a gerente então remanejava para fechar cobertura, e as remanejadas se sentiam traídas ('o que escolhi vs a escala final são completamente diferentes'). O experimento acabou cancelado apesar de 7 em 10 enfermeiras sentirem falta dele. Mecânicas que funcionaram: (a) a gerente pré-preenchia os horários fixos no template para mostrar exatamente onde havia vaga; (b) equipe dividida em 3 grupos com janela de 1 semana cada para escolher, com RODÍZIO de qual grupo escolhe primeiro a cada mês — avaliado pelas próprias enfermeiras como 'o mais justo possível'; (c) guidelines públicos por senioridade (mínimos por turno, 2 sextas/mês, fds a cada 2-3 semanas, rotação dia/noite de 50%/25%/0% conforme anos de casa); (d) pedidos de mudança caíram de 38/mês para ~10/mês. Lição central dos autores: self-scheduling só funciona se todos mantêm a 'dual agenda' (necessidade da unidade E do indivíduo); quando o pedido vira direito adquirido, todos perdem.

*Fonte: https://web.mit.edu/workplacecenter/docs/wpc0019.pdf*

**Aplicação no HCB:** Dois usos diretos: (1) argumento técnico na decisão planilha vs app — o que matou o experimento foi a ausência de validação no momento da inscrição; um formulário que mostra vagas restantes por turno e recusa pedido acima da cota (coisa que o app React/Supabase faz trivialmente e a planilha só faz com proteção pesada) ataca exatamente esse modo de falha; (2) comunicação: deixar escrito desde o início que preferência atendida não é garantia — cobertura manda — que é a nossa regra 'preferência não é lei' dita ANTES do conflito, não durante.

### Grupo real de 60 hospitalistas: escalista única como câmara de compensação e regras de precedência públicas

Hospitalists of Northern Michigan (60 médicos, Traverse City) profissionalizou o ciclo: uma scheduler dedicada processa TODAS as mudanças — os médicos não precisam caçar colega para trocar plantão; ela intermedia. Regras de precedência explícitas e públicas (ex.: educação continuada/CME tem prioridade sobre férias) eliminam a negociação caso a caso. Pedidos podem ser feitos com até 15 meses de antecedência e a escala sai em blocos de 3 meses; cargas anuais individuais são contratadas por faixa (120 a 270 turnos/ano, de 12 a 20 turnos/mês conforme o acordo de cada um). A SHM (Society of Hospital Medicine) complementa com as melhores práticas do setor: cadência regular de coleta de pedidos, 'é ok impor limites de pedidos para garantir justiça e cobertura', rastrear pedidos de férias/feriados para distribuição equitativa, e sistema de troca médico-a-médico que não consome tempo do scheduler; o scheduler não precisa ser médico — pode ser administrativo com supervisão médica.

*Fonte: https://todayshospitalist.com/how-to-take-the-squabbling-out-of-scheduling/ e https://www.hospitalmedicine.org/wp-content/uploads/2024/10/pm-23-0003-schedule-management-resource.pdf*

**Aplicação no HCB:** Confirma que ~60 médicos é exatamente a escala em que o processo precisa se profissionalizar: a escalista do HCB deve ser canal único (nada de acerto paralelo com a chefia), com tabela de precedência publicada (ex.: licença legal > congresso > férias > preferência de folga) — hoje essas prioridades existem só na cabeça dela. O limite explícito de pedidos por médico ('é ok impor limites') dá respaldo institucional para trocar o e-mail livre por formulário com cotas.

### Pedidos estruturados + loteria sequencial compensatória: 1ª escolha atendida saltou de 30% para 80% (paper com métricas)

Programa de residência substituiu a montagem manual dos chiefs por ferramenta (Excel+VBA) alimentada por formulário estruturado: cada residente RANQUEIA todos os blocos de férias por desejabilidade e indica top-3 preferências de rotação; casos especiais (casamento, licença parental) entram como campo de texto tratado à parte, manualmente, ANTES da rodada automática. O algoritmo roda uma 'sequential scheduling lottery': quem teve preferências menos atendidas numa rodada ganha prioridade na seguinte — equidade dinâmica em vez de senioridade fixa. Resultados medidos: 1ª escolha atendida subiu de 30,5% para 80,5% (residentes) e de 69% para 96% (internos); percepção de justiça subiu de 3,3 para 4,2 (escala 5); conflitos de escala caíram de 0,7 para 0,3 por interno; tempo de montagem caiu de semanas para dias.

*Fonte: https://pmc.ncbi.nlm.nih.gov/articles/PMC7418963/*

**Aplicação no HCB:** O formato do formulário é o insight: em vez de 'me manda suas preferências por e-mail', pedir estrutura fixa — N datas de folga desejadas RANQUEADAS + campo separado para eventos inegociáveis (casamento, prova de título) tratados como camada distinta antes do algoritmo. E o mecanismo 'quem foi menos atendido este mês escolhe primeiro no próximo' é implementável na nossa planilha/app com uma coluna de score de atendimento por médico — resolve a queixa clássica de 'sempre os mesmos são atendidos' sem precisar de senioridade.

### Equidade como livro-razão contínuo, não foto mensal: banda de ±20% e feriado que não repete

Framework para grupos de emergência: medir noites e fins de semana em janela móvel de 6-12 meses (nunca zerar no mês) e sinalizar quem está >20% acima ou abaixo da média do grupo; contar separadamente o TOTAL de noites e as SEQUÊNCIAS de 3+ noites consecutivas (dez noites espaçadas ≠ dez noites em três blocos brutais); rodar feriados de modo que ninguém trabalhe o mesmo feriado importante dois anos seguidos; ajustar cotas proporcionalmente ao FTE/carga contratada de cada um; e — ponto central — dar a cada médico visibilidade da própria posição em relação ao grupo ('when providers can see their own standing... a maioria dos conflitos desaparece preventivamente'), em vez de depender da palavra do diretor.

*Fonte: https://www.slipstreamer.app/blog/fair-er-scheduling-night-weekend-equity*

**Aplicação no HCB:** Nossa equidade anual da planilha v4 já é o ledger — falta (1) a banda de tolerância explícita (±20% da média, proporcional à CH de cada contrato) para separar 'dentro do normal' de 'precisa corrigir no próximo mês', (2) a memória de feriados ano-a-ano (quem trabalhou o Natal de 2026 não pega o de 2027 — registrar já em novembro/dezembro), e (3) a página individual: cada médico vendo seus números vs a média do grupo, que é exatamente o que a página pública de preferências da equipe pode evoluir para mostrar.

### Política de trocas pós-publicação: os dois combinam antes, canal único registra, escalista aprova (não corretora)

Convergência de três fontes: (guia de chief residents) a política deve exigir que dois residentes acordem a troca ENTRE SI antes de levá-la ao chief — 'seu papel é aprovador, não corretor'; um Google Form simples de troca força documentação e cria trilha de auditoria, com 3 checagens na aprovação (limite de horas, composição da equipe no turno, conflitos). (Manual da UW) qualquer um pode trocar desde que ambos sejam habilitados para o plantão trocado; quem troca para um plantão que não pode assumir fica responsável por arranjar cobertura; toda troca é notificada a uma pessoa/canal nomeado por site. (SHM) o ideal é troca médico-a-médico sem consumir tempo do scheduler. Complemento (guia de chiefs): sistema 'jeopardy' — um designado de sobreaviso por período absorve ausências imprevistas, definido ANTES do ciclo começar, nunca improvisado no plantão das 6h.

*Fonte: https://www.trythrawn.com/blog/scheduling-chief-residents*

**Aplicação no HCB:** Encaixa na nossa regra 'troca é fluxo normal': formalizar em 4 linhas na página pública — (1) troca só depois da escala final, (2) os dois combinam entre si primeiro, (3) registro num canal único (form/WhatsApp estruturado/app) com data, turno e os dois nomes, (4) validador roda CLT+cobertura antes do ok da escalista. E avaliar um sobreaviso designado por fim de semana em novembro (com crédito no ledger), em vez de caçar voluntário por WhatsApp quando alguém adoece.

### Regras de política de self-scheduling de enfermagem: prazo perdido, cotas e proteção do primeiro grupo

Guias de política de self-scheduling (Paypro, práticas de nurse managers) especificam mecânicas de enforcement: quem perde o prazo de inscrição PERDE o direito de pedir — o gestor aloca suas horas ('anyone who fails to enter their hours by the deadline loses their chance to request hours'); mínimo de 2 grupos de rodízio para quem escolhe primeiro, e o grupo que escolheu primeiro fica PROTEGIDO de remanejamento no balanceamento; teto de quantas pessoas podem pedir férias/folga no mesmo dia; exigência mínima universal (ex.: 1 turno de fds por mês para todos); rodízio de esqueleto de feriado registrado para todos passarem por feriado ao longo do ano; e no balanceamento final, critério de desempate público (lá, senioridade). A troca de turnos fica permitida para necessidades surgidas APÓS a publicação.

*Fonte: https://payprocorp.com/resources/blog/the-complete-guide-to-writing-a-nurses-self-scheduling-policy/*

**Aplicação no HCB:** Dá as cláusulas que faltam no nosso ciclo: (1) consequência clara e impessoal para atraso — 'não mandou preferência até o dia X, a escalista aloca livremente' (protege a escalista de pressão retroativa: quem atrasou não reclama); (2) teto de pedidos de folga por DIA do mês (evita 8 pedidos para a mesma sexta de feriadão); (3) critério de desempate público quando dois pedem a mesma folga — no nosso caso pode ser o score de atendimento do mês anterior em vez de senioridade.

**Recomendações desta lente:**

- Publicar o CALENDÁRIO DO CICLO de novembro de trás pra frente e tratá-lo como contrato: ex. dia 01/10 abre o formulário de preferências · 15/10 fecha (quem não mandou, a escalista aloca livremente — regra dita antes, aplicada sem exceção) · 20/10 sai a escala PRELIMINAR com checklist do que cada médico deve conferir · 24/10 fecha a janela de revisão · 25/10 escala FINAL congelada · trocas só a partir daí. É o desenho UW: preliminar + deadline de revisão datado + proibição de trocar antes da final.
- Substituir o e-mail livre por FORMULÁRIO ESTRUTURADO com cotas: N folgas desejadas ranqueadas (ex. até 4), 1-2 pedidos 'inegociáveis' por semestre para eventos com comprovação de vida real (casamento, prova de título) tratados como camada separada, preferências de turno/dia estáveis (já capturadas na página de preferências), e teto de pedidos por dia do calendário. Formulário obrigatório mesmo sem preferência — 'não tenho pedido este mês' também é informação.
- Formalizar o LIVRO-RAZÃO de créditos que a planilha v4 já calcula: crédito (call break) para quem cobre buraco ou feriado extra, débito para quem larga plantão, memória de feriados ano-a-ano, tudo em janela móvel de 12 meses com banda de tolerância de ±20% da média proporcional à CH contratada. Publicar a posição individual junto com a escala — médico que vê o próprio número não abre discussão.
- Adotar 'quem foi menos atendido escolhe primeiro': uma coluna de score de atendimento por médico (quantos % dos pedidos do mês foram honrados) e prioridade invertida no mês seguinte — equidade dinâmica comprovada (1ª escolha de 30%→80% no caso publicado) e mais defensável que senioridade num grupo CLT.
- Política de TROCAS em 4 linhas na página pública: só após a escala final · os dois combinam entre si antes · registro em canal único com trilha (o app é o lugar natural) · validador roda CLT+cobertura antes do aceite da escalista, que aprova mas não sai caçando substituto. Avaliar sobreaviso designado por fds (com crédito no ledger) para ausências de última hora.
- Na decisão planilha vs app, o critério desta lente: o modo de falha que matou o self-scheduling no caso MIT foi inscrição sem validação em tempo real (turno cheio aceitando gente, cota estourada, remanejamento manual gerando ressentimento). O formulário de preferências com contador de vagas ao vivo e recusa automática acima da cota é o ponto onde o app React/Supabase ganha da planilha por natureza — mesmo que a montagem e a exportação Senior continuem no pipeline Python/planilha por enquanto.
- Blindar a escalista institucionalmente: canal único de pedidos (nada vale se não está no formulário — 'mesmo que você já tenha avisado alguém', como no manual UW), tabela de precedência pública (licença legal > evento inegociável > férias > preferência), e mudanças de regra decididas pelo grupo com a chefia (na UW, 2/3 dos votos), para que a regra pertença à equipe e não à pessoa que monta.


## 3 · Otimizadores (CP-SAT, Timefold, literatura)

**Resumo.** O padrão que resolve o nosso caso já tem nome e ferramenta pronta: "pinning + replanejamento" (Timefold) ou "re-rostering / minimal perturbation" (literatura) — o otimizador congela tudo que a escalista fixou à mão e só preenche/conserta o resto, minimizando mudanças em relação ao rascunho. O Google OR-Tools CP-SAT é a via mais barata para nós: é Python puro (encaixa no pipeline que já gera a planilha), e o exemplo oficial shift_scheduling_sat.py já traz prontas as mecânicas exatas que precisamos — transição proibida noite→manhã, mínimos/máximos semanais com penalidade suave, cobertura por turno e pedidos de preferência maximizados no objetivo; cota de fim de semana e equidade min-max são extensões de meia dúzia de linhas. A explicabilidade tem mecânica documentada no Timefold (ScoreAnalysis: score decomposto por constraint, com justificativa por plantão/médico), que podemos replicar: cada célula da escala ganha um "porquê" auditável. A literatura (INRC-II, survey de physician scheduling, framework MIP+GUI de 2025) valida a arquitetura em três camadas que já temos meio construída: preferências estruturadas → solver que completa → publicação nos formatos conhecidos, com re-planejamento como fluxo normal e não exceção.

### Timefold: pinning é o mecanismo nativo de 'respeitar o que a escalista já fixou'

No Timefold (sucessor do OptaPlanner), uma entidade marcada com @PlanningPin não é tocada pelo solver: o plantão fica imutável e só o restante é otimizado. Para listas há @PlanningPinToIndex, que congela o prefixo da lista (tudo antes do índice fica fixo, o resto é replanejável). No produto de Employee Shift Scheduling, turnos marcados como fixos no input são tratados como imutáveis e apenas os não-pinados são reatribuídos na re-otimização; há ainda 'disruption rules' — soft constraints que penalizam mudar um turno dentro de uma janela de tempo, com multiplicador por período (mudar amanhã custa caro, mudar daqui a 3 semanas custa pouco).

*Fonte: https://docs.timefold.ai/timefold-solver/latest/responding-to-change/responding-to-change*

**Aplicação no HCB:** É exatamente o fluxo da escalista do HCB: ela fixa à mão os plantões negociados (trocas, pedidos pessoais, feriados já combinados) e o otimizador só preenche buracos. Em novembro: transcrever o esboço dela como células 'pinadas' e rodar o solver só nos vazios — nunca remontar o que já foi acordado.

### Timefold: continuous planning com janela de publicação (freeze window)

O padrão documentado: definir um instante de congelamento (freezeDeparturesBeforeTime no exemplo de rotas; na escala, a data de publicação) e, antes de cada re-solve, pinar automaticamente tudo que está antes dessa fronteira. Replanejamentos sucessivos avançam a fronteira, preservando decisões já assumidas e otimizando só a janela restante. Mudanças em tempo real entram via ProblemChange (API addProblemChange), que altera a solução de trabalho sem reiniciar o solver; em modo daemon o solver fica bloqueado esperando mudanças e retoma sozinho.

*Fonte: https://timefold.ai/blog/continuous-planning-optimization-with-pinning*

**Aplicação no HCB:** Modela o ciclo real do HCB: escala publicada no dia X, mas trocas e atestados continuam chegando o mês inteiro. Dias já trabalhados ou já publicados ficam congelados; o solver só mexe do 'hoje' em diante. Serve tanto para a planilha (re-rodar script) quanto para o app (botão 'completar buracos').

### Timefold: fairness de fábrica com ConstraintCollectors.loadBalance

A equidade é uma constraint de grupo: groupBy(ConstraintCollectors.loadBalance(Shift::getEmployee)) produz uma métrica 'unfairness' (0 = perfeito) que o solver penaliza como soft constraint. A doc recomenda score em BigDecimal porque a unfairness é racional e diferenças minúsculas (1.000001 vs 1.000002) precisam ser distinguíveis para o solver escolher entre soluções; a métrica escala linearmente com o tamanho do dataset. A filosofia é min-max: 'a solução é justa se o funcionário com mais tarefas tem o mínimo possível de tarefas'. Aviso da doc: constraints de fairness competem com as demais e deixam o solve mais lento.

*Fonte: https://docs.timefold.ai/timefold-solver/latest/constraints-and-score/load-balancing-and-fairness*

**Aplicação no HCB:** Nossa 'equidade anual' vira uma constraint formal em vez de conferência visual: balancear plantões de fds e noites por médico dentro do mês E acumulado do ano (carry-over de outubro entra como carga inicial de cada médico antes do solve de novembro).

### Timefold: explicabilidade pronta — ScoreAnalysis decompõe o score por constraint com justificativa por plantão

Endpoint GET /v1/schedules/{id}/score-analysis?includeJustifications=true devolve JSON com cada constraint, seu peso, seu score agregado e a lista de matches — cada match com o score que causou e uma justification apontando shift + employee concretos (objetos que implementam ConstraintJustification, com metadados que o dev escolhe expor). Casos de uso documentados: explicar por que uma atribuição aconteceu, investigar não-atribuições forçando uma designação hipotética e comparando os dois scores, e validar mudanças manuais submetendo a escala editada para análise imediata (POST score-analysis sob demanda).

*Fonte: https://docs.timefold.ai/employee-shift-scheduling/latest/user-guide/score-analysis*

**Aplicação no HCB:** O 'critério público' que a equipe do HCB precisa: ao lado de cada plantão, mostrar 'Fulano entrou aqui porque: cobre o mínimo do turno (+), estava abaixo da cota de fds (+), sem sequência N→M (ok)'. Mesmo sem Timefold, replicamos a mecânica: nosso validador CLT já computa violações — basta computar também as contribuições positivas e publicar por célula.

### OR-Tools CP-SAT: exemplo oficial de nurse scheduling — preferências entram direto no objetivo

Variáveis booleanas shifts[(n,d,s)], add_exactly_one garante 1 profissional por turno/dia, add_at_most_one limita a 1 turno/dia por pessoa. Distribuição equitativa por aritmética: min_shifts_per_nurse = (num_shifts*num_days)//num_nurses e max = min+1 se não divide exato, imposto com model.add(min <= sum(shifts_worked) <= max). Pedidos viram matriz shift_requests[n][d][s] e o objetivo é model.maximize(sum(shift_requests[n][d][s] * shifts[(n,d,s)])) — o produto só vale 1 quando o turno foi atribuído E era pedido, então o solver maximiza pedidos atendidos (13 de 20 no exemplo).

*Fonte: https://developers.google.com/optimization/scheduling/employee_scheduling*

**Aplicação no HCB:** As preferências que hoje chegam por e-mail em texto livre viram uma matriz por médico×dia×turno (com pesos: 'quero muito'=+2, 'posso'=+1, 'não posso'=hard). O solver então maximiza pedidos atendidos sujeito à cobertura — codifica a nossa regra 'preferência não é lei, cobertura ganha'.

### OR-Tools CP-SAT: shift_scheduling_sat.py tem prontas as mecânicas de sequência proibida, janelas soft e transições penalizadas

O exemplo avançado traz três funções reutilizáveis: (1) add_soft_sequence_constraint — janelas de comprimento de sequência com hard_min/soft_min/soft_max/hard_max; sequências fora do hard são proibidas via add_bool_or(negated_bounded_span(...)), fora do soft geram literal de custo com coeficiente proporcional ao desvio; (2) add_soft_sum_constraint — soma semanal com IntVar limitado por hard_min/hard_max e excesso/déficit penalizado via add_max_equality(excess,[delta,0]); (3) penalized_transitions — para cada par (turno_anterior, turno_seguinte, custo), add_bool_or([~work[e,prev,d], ~work[e,next,d+1]]): custo 0 = proibição hard ('night to morning is forbidden' está literalmente no exemplo), custo>0 = literal penalizado. Cobertura mínima por demanda com excesso penalizado. Tudo somado num único model.minimize linear.

*Fonte: https://github.com/google/or-tools/blob/stable/examples/python/shift_scheduling_sat.py*

**Aplicação no HCB:** Mapa 1:1 com nossas regras: N→M vira transição com custo 0 (o caso N→T de 6h vira custo>0, penalizado mas possível); teto de 44h vira soft_sum semanal; cota de fds vira extensão simples — bool trabalha_fds[e][w] com add_max_equality sobre os turnos de sáb/dom e sum(trabalha_fds[e]) <= cota[e]; equidade min-max: add_max_equality/add_min_equality sobre as contagens por médico e minimizar (max-min) no objetivo.

### CP-SAT: fixar variáveis + AddHint = o 'assistente que completa' sem framework nenhum

Duas alavancas: (1) o que a escalista fixou vira constraint dura — model.add(work[e,s,d] == 1) para cada célula preenchida à mão — e o solver só decide os buracos; (2) a escala do mês anterior (ou o rascunho atual inteiro) entra como solution hint via AddHint/solution_hint: dois vetores paralelos (índices de variáveis, valores) que o solver usa como ponto de partida do branching ('phase saving'), sem obrigação de satisfazê-los — hints parciais e até infactíveis são aceitos e ajudam procedimentos de reparo. Para minimizar mudanças num replanejamento, adiciona-se ao objetivo um termo de distância: sum de literais 'mudou[e,d]' comparando com a atribuição anterior.

*Fonte: https://github.com/google/or-tools/blob/stable/ortools/sat/docs/model.md*

**Aplicação no HCB:** Arquitetura mínima para novembro sem sair do Python: script lê a planilha, células preenchidas = constraints fixas, células vazias = variáveis livres, escala corrente = hint, objetivo = pedidos atendidos + equidade − mudanças. Roda em segundos para 66 médicos × 30 dias × 3 turnos (~6.000 booleanas, pequeno para o CP-SAT).

### O padrão (d) na literatura tem nome: re-rostering / minimal perturbation problem

O Minimal Perturbation Problem busca a solução mais parecida possível com uma atribuição inicial dada, sob constraints novas. Na escala hospitalar chama-se 'nurse re-rostering': ausências rompem a escala publicada e o reparo minimiza o número de desvios em relação à escala original — há matheurísticas de 'perturbação' baseadas em local branching que constroem a nova solução na vizinhança da solução de referência. A linha de 'robust rostering' complementa: reparos de última hora afetam a vida das pessoas, então vale construir escalas já robustas a ausências (folgas estratégicas que viram reserva).

*Fonte: https://www.sciencedirect.com/science/article/abs/pii/S0377221718302145*

**Aplicação no HCB:** Dá vocabulário e forma ao que o HCB já vive ('trocas e exceções fazem parte do fluxo'): o objetivo do replanejamento não é a escala ótima, é a escala válida com MENOS mudanças. O termo de busca para aprofundar é 'nurse rerostering problem' e 'minimal perturbation'.

### INRC-II: a competição já era multi-estágio (semana a semana) e os vencedores eram exatos, não heurísticos

A INRC-II abandonou o formato estático: a escala é construída semana a semana sem conhecer as semanas futuras, com histórico carregando contagens (exatamente o carry-over que fazemos). O vencedor formulou o problema como modelo de fluxo em rede (Römer & Mellouli 2016); o segundo lugar (Legrain, Omer & Rosat, Polytechnique Montréal) usou branch-and-price baseado em 'rotações' — cada coluna do IP é uma sequência de dias consecutivos trabalhados seguida de descanso — publicado depois como paper e como código aberto C++ (lab-core/NurseScheduler, com instâncias e validador da competição). Simulated annealing com large neighborhoods também alcança resultados competitivos na versão estática. Lição recorrente: os melhores métodos priorizam factibilidade sempre (o 3º colocado foi o único do pódio a achar solução factível em toda instância — isso é destacado como diferencial).

*Fonte: https://github.com/lab-core/NurseScheduler*

**Aplicação no HCB:** Valida duas escolhas nossas: (1) o carry-over anual de equidade é padrão da área, não gambiarra; (2) para 66 médicos não precisamos de branch-and-price acadêmico — CP-SAT resolve — mas a estrutura de 'rotação' (bloco trabalho+descanso como unidade) é boa abstração para validar CLT: pensar em blocos, não em células soltas.

### Survey de physician scheduling (Erhard et al., EJOR 2018): o problema se divide em staffing, rostering e re-planning

Revisão de 68 papers de escala DE MÉDICOS (não enfermagem — restrições e cultura diferentes: médicos têm mais poder de barganha, preferências pesam mais). Classifica o campo em três problemas: staffing (dimensionar equipe), rostering (montar a escala mensal) e re-planning (ajustes de curto prazo) — e nota que re-planning é o menos estudado e o mais sentido na prática. Confirma que MIP é o método dominante e que satisfação de preferências é objetivo de primeira classe em escala médica, não acessório.

*Fonte: https://www.sciencedirect.com/science/article/abs/pii/S0377221717305787*

**Aplicação no HCB:** Nomeia nossas três dores separadamente: novembro é 'rostering' (solver completa), as trocas do mês são 're-planning' (minimal perturbation), e a pergunta 'a equipe de 66 dá conta das 4 camadas?' é 'staffing' — que a planilha v4 já responde por aritmética. Tratar como três features distintas, não uma.

### Framework MIP + GUI web para physician rostering (arXiv 2025) — o espelho acadêmico do nosso app, com a mecânica aberta

Sistema em uso diário real (TUM/JKU): MIP em Python atrás de um app Flask onde médicos marcam preferências em 5 níveis (strongly desired / desired / indifferent / undesired / impossible) por dia, por semana e por fim de semana (concentrar vs espalhar fds), e o planejador configura tudo por formulário, sem ver matemática. Pré-atribuições em dois níveis: médico inteiro 'manually planned' (sai da otimização) ou plantão específico pre-assigned. Fairness via 'pools': cada pool define um conjunto de plantões + médicos elegíveis, calcula target_num proporcional a jornada contratual × dias disponíveis, e penaliza desvios acima/abaixo do alvo com variáveis de violação no objetivo. Não é open source, mas o paper descreve o modelo inteiro.

*Fonte: https://arxiv.org/abs/2511.14536*

**Aplicação no HCB:** Dois roubos diretos para o nosso app: (1) a escala de preferência em 5 níveis com 'impossible' como único hard — resolve a ambiguidade dos e-mails em texto livre com um formulário curto; (2) o conceito de pool com alvo proporcional à jornada — é como tratar a Laura provisória sem dar o dobro a ela de novo: o alvo dela se ajusta pela disponibilidade real.

### Sistema ASP em produção no Hospital Universitário de Yamanashi — otimizador exato roda escala real de hospital há anos

Paper de 2025 descrevendo sistema em produção que usa Answer Set Programming para escala de enfermagem multi-departamento, reconciliando preferências individuais com necessidade de cobertura via hard/soft constraints. Os autores enfatizam que instâncias reais têm desafios além dos benchmarks de competição (regras locais idiossincráticas, mudanças constantes) — o valor está na manutenção contínua das regras, não no algoritmo em si.

*Fonte: https://arxiv.org/abs/2506.13600*

**Aplicação no HCB:** Prova de viabilidade operacional: hospital real, escala real, otimizador declarativo em produção. A lição para o HCB é a mesma do nosso histórico de outubro: as regras mudam (rotina só manhã, teto 44h puro) — o sistema precisa que a regra seja dado editável, não código.

**Recomendações desta lente:**

- Para novembro, implementar o 'assistente que completa' em CP-SAT dentro do pipeline Python que já gera a planilha: células preenchidas pela escalista = model.add(var==1) (pinning), células vazias = variáveis livres, objetivo = maximizar pedidos atendidos + minimizar (max−min) de fds/noites por médico − penalizar mudanças vs rascunho. É ~1 dia de trabalho sobre o shift_scheduling_sat.py e não exige decidir agora entre planilha e app.
- Estruturar as preferências no formulário com a escala de 5 níveis do framework arXiv:2511.14536 (quero muito / quero / indiferente / evitar / impossível), sendo 'impossível' o único hard — substitui o e-mail em texto livre e alimenta direto a matriz shift_requests do solver.
- Copiar a mecânica de explicabilidade do Timefold ScoreAnalysis sem usar Timefold: o validador CLT já lista violações; estender para listar também contribuições positivas por célula e publicar um 'porquê' por plantão na própria planilha/PDF (comentário na célula ou coluna de auditoria). Critério público mata a percepção de favorecimento.
- Tratar rostering (montar novembro) e re-planning (trocas do mês) como dois modos do mesmo solver: o segundo é o primeiro com tudo pinado até 'hoje' + termo de minimal perturbation no objetivo. Nunca oferecer 'remontar do zero' como ação padrão.
- Se a decisão pender para o app próprio: o CP-SAT não roda em Vercel function com folga, mas roda como script local/cron que escreve no Supabase — o drag-and-drop existente vira a camada de pinning (o que a Mariana arrastar fica fixo) e um botão 'completar buracos' chama o solver. Timefold (Java, ou a versão Python) só se compensar terceirizar constraints prontas + score analysis.
- Registrar o carry-over de equidade anual como estado de entrada do solver (carga inicial por médico), padrão validado pela INRC-II multi-estágio — nunca recalcular equidade olhando só o mês corrente.


## 4 · Produtos internacionais

**Resumo.** O mercado internacional de physician scheduling convergiu num mesmo desenho mecânico: (1) preferências entram por formulário estruturado com janela de pedidos, prazo e limite por pessoa — nunca texto livre; (2) o motor gera um RASCUNHO tratando pedidos como pré-aprovados e usando penalidades ponderadas (regras flexíveis com min/max), e a escalista sempre revisa antes de publicar — nenhum produto entrega automação 100% na prática, como os reviews do Lightning Bolt e QGenda confirmam; (3) vaga descoberta vira item publicado num "pool" que qualquer elegível pode pegar, com notificação, em vez de convocação 1-a-1; (4) trocas são self-service com validação automática de regras na hora e aprovação em camadas (colega → chefia), sempre com trilha de auditoria; (5) publicação é multi-formato — grade, PDF, feed ICS assinável que se auto-atualiza — e a folha de pagamento é um DERIVADO automático da escala viva (job codes/pay codes recalculados a cada mudança), exatamente o papel dos códigos Senior no caso HCB. Todos os players são web apps com self-service; nenhum é planilha — o que pesa na decisão planilha-inteligente vs app próprio.

### QGenda · coleta de pedidos com janela, limite e validação na entrada

Médicos lançam pedidos (férias, no-call, academic day) direto na própria escala via web/mobile. 'Rolling Request Limits' abre uma janela de pedidos por período e depois FECHA a janela para o admin produzir a escala daquele mês. Há limite duro de pedidos por pessoa (Requesting Limits) e limite diário de férias por grupo, com Request Waitlist para excedentes. Antes de aceitar, o sistema valida 8 critérios automaticamente: permissão para a tarefa, existência da tarefa no dia, disponibilidade, conflito com atribuições existentes, regras de bloqueio, limite individual, limite por tarefa e se o solicitante é a última pessoa disponível para outra função. Aprovação do admin é opcional e configurável.

*Fonte: https://www.qgenda.com/physician-scheduling/self-scheduling-online-requesting/*

**Aplicação no HCB:** Substitui o e-mail em texto livre: formulário com janela de pedidos (ex.: dia 1-10 do mês anterior), limite de pedidos por médico e validação imediata contra cota de fds/CLT na hora em que a pessoa digita — não semanas depois quando a escalista lê o e-mail.

### QGenda · gerador trata pedidos como já aprovados

Na automação, o QGenda gera a escala 'como se' os pedidos de férias submetidos já estivessem aprovados, mesmo pendentes — a filosofia é que quem pediu antes não deve ser escalado naquele dia. O Lightning Bolt tem o mesmo conceito: pedidos aprovados auto-populam na escala e existe o modo 'Generate with Pending Requests' que gera considerando também os pendentes.

*Fonte: https://www.qgenda.com/physician-scheduling/managing-vacation-requests-in-qgenda/*

**Aplicação no HCB:** Nosso gerador Python deve bloquear os dias pedidos ANTES de montar (pedido = célula indisponível), e a escalista só desbloqueia manualmente se a cobertura não fechar — coerente com 'cobertura ganha da preferência', mas com o pedido respeitado por padrão.

### QGenda · como o auto-gerador prioriza regras

O motor usa 'Sort Order': distribui primeiro as tarefas mais críticas de equidade (call e plantões noturnos) e só depois o resto. Regras flexíveis são declaradas com mínimo E máximo (ex.: dias consecutivos), não valor fixo. Cada tarefa pode ter peso numérico, e o algoritmo faz 'look ahead' para garantir solução 100% de cobertura antes de conceder preferências. Filtros aplicam regras diferentes a subgrupos de profissionais.

*Fonte: https://www.qgenda.com/blog/qgenda-prioritizes-rules-automated-physician-scheduling/*

**Aplicação no HCB:** Valida a nossa DICA da ordem de montagem (fds primeiro e mais justo, depois feriado, depois semana) — é literalmente o Sort Order do QGenda. Regras do CONFIG deveriam virar pares min/max com peso, não valores rígidos que ninguém confere (o caso da cota de fds sem validador).

### Lightning Bolt/PerfectServe · otimização combinatória, ~400 regras por cliente, humano revisa

O motor usa otimização combinatória para escolher a melhor escala entre milhões de variações, com regras rígidas e preferências ponderadas — em média 400+ regras por cliente cobrindo preferências individuais, skills, FTE, recuperação pós-noturno e restrições de residência. O fluxo é: admin dispara a geração, o motor devolve escala completa sem buracos, admin revisa e ajusta com fills/removals manuais antes de publicar. Nos comentários verificados do KLAS, usuários reais relatam que 'prometeram que a maioria da escala seria gerada automaticamente' e não se concretizou, e que 'gastamos muito tempo desenvolvendo regras de agendamento muito específicas'.

*Fonte: https://klasresearch.com/comments/perfectserve-lightning-bolt-scheduling/2867*

**Aplicação no HCB:** Expectativa realista pro objetivo 'automatizar ao máximo': até o líder de mercado funciona como GERADOR DE RASCUNHO + revisão humana. Nossa meta de novembro deve ser rascunho automático sem buracos + validador visível, não escala final sem toque humano.

### ShiftAdmin · master request calendar + penalidades ponderadas customizáveis

Todos os pedidos caem num 'master request calendar' central onde o scheduler revisa, nega ou altera qualquer pedido, e pode inserir pedidos fixos por outros (locums, per diem). 'Contratos' definem as regras de cada pessoa individualmente. O auto-gerador avalia centenas de milhões de combinações contra critérios com PESOS DE PENALIDADE customizáveis — violar uma preferência custa pontos, não invalida a escala. Foi o software mais usado em residências de emergência dos EUA (53% num survey). Publica com notificação por e-mail/SMS e exporta iCal/Outlook/Google/PDF; payroll via API (ADP, Paylocity etc.).

*Fonte: https://www.aliem.com/5-scheduling-software-options/*

**Aplicação no HCB:** O modelo de penalidade ponderada é a formalização exata do nosso 'regras são metas frouxas' e 'preferência não é lei': o gerador minimiza penalidade total em vez de tratar preferência como restrição dura — encaixa direto no validador que já temos.

### ByteBloc · gradação need-off vs wish-off e payroll 'as worked'

Feito por um emergencista desde 1989. As preferências têm GRADAÇÃO explícita: 'need off' (preciso folgar — duro) vs 'wish off' (queria folgar — suave), além de pedido de turno e férias online. Depois de configurado, gerar escala 'é apertar um botão'. Trocas via 'Swap-meet': listagem central onde providers podem dividir (split), trocar (trade) ou doar (give away) plantões. Notificação automática de publicação por e-mail/SMS e download da escala 'as worked' (como de fato aconteceu, pós-trocas) para o payroll.

*Fonte: https://www.bytebloc.com/Physician-Scheduling.aspx*

**Aplicação no HCB:** Duas ideias prontas: (1) o formulário de preferências deve distinguir 'não posso' de 'preferia não' — hoje o e-mail livre mistura os dois e a escalista adivinha; (2) o export Senior deve sair da escala 'as worked' (pós-trocas do mês), não da escala publicada no dia 1.

### Amion · trocas em camadas com negociação por e-mail e rastreio

Scheduler habilita em File/Preferences/Amion Trades ('Swap shifts online'). O médico abre o calendário de swap, escolhe o plantão que quer largar e vê os plantões do colega (ou o pool de disponíveis). A troca só é final após: (1) aceite do colega envolvido e (2), se configurado, aprovação final do scheduler — que é notificado quando as duas partes concordam. A negociação roda por e-mail automático. 'Flag switches' marca visualmente na grade quais plantões mudaram por troca (auditoria).

*Fonte: https://support.amion.com/hc/en-us/articles/35198283942675-Swaps*

**Aplicação no HCB:** Fluxo mínimo viável de troca pro app: proposta → aceite do colega → aprovação da Mariana → grade atualiza sozinha e o plantão fica marcado como 'trocado'. Elimina o vai-e-vem de WhatsApp e o retrabalho de editar a planilha.

### Amion · vaga descoberta vira pool automático de open shifts

Com a preferência 'Pick up open shifts' marcada, TODA vaga descoberta da escala aparece automaticamente no pool de swap online, onde qualquer pessoa elegível pode reivindicá-la (self-scheduling). Alternativa granular: criar um 'staff' fictício chamado Open, escalá-lo nos buracos escolhidos e marcá-lo como 'available for giveaway'. Staff também pode jogar plantões próprios no pool com um ícone de broadcast. Há ainda uma visão 'Show Only Unfilled Days' para a escalista enxergar só os buracos.

*Fonte: https://support.amion.com/hc/en-us/articles/25786783996307-Pick-up-open-shifts-Self-Scheduling*

**Aplicação no HCB:** Em vez de a Mariana convocar 1-a-1 por WhatsApp quando sobra buraco: publicar os buracos numa lista 'plantões disponíveis' visível a todos os 66, com notificação — quem pega primeiro (e passa no validador CLT) leva. Reduz o ciclo de dias para minutos.

### Amion · publicação por assinatura ICS que se auto-atualiza

Cada médico assina um feed de calendário (Google/Apple/Outlook) e as mudanças no Amion fluem automaticamente para o calendário pessoal: 300 dias futuros + 2 semanas passadas. Não é export estático — troca aprovada hoje aparece no iPhone do médico sem ninguém reenviar nada.

*Fonte: https://support.amion.com/hc/en-us/articles/26561852130067-Calendar-Subscriptions*

**Aplicação no HCB:** Complemento barato aos 3 formatos atuais (grade, PDF individual, códigos RH): um feed ICS por médico gerado do Supabase. O PDF continua sendo o formato oficial que a equipe conhece; o ICS resolve o problema de versão desatualizada no bolso.

### Petal Health · troca com guardrails validados na hora

Médicos lançam indisponibilidades direto no próprio calendário (nada de sistemas paralelos) e negociam trocas sem intermediário, mas dentro de guardrails: o sistema transforma os parâmetros do hospital em regras e, se uma troca proposta violar uma regra, BLOQUEIA/SINALIZA instantaneamente antes de efetivar. As 6 mecânicas de troca: autonomia sem intermediário; aprovação configurável por perfil (auto-aceitar entre experientes, exigir aprovação para residentes); filtro automático que só oferece o plantão a colegas qualificados E disponíveis; acesso mobile 24/7 com status em tempo real; grade atualizada automaticamente com notificação a todos os afetados; histórico completo de cada requisição (quem, quando, o quê, ação tomada).

*Fonte: https://blog.petal-health.com/shift-trades-between-doctors-6-features*

**Aplicação no HCB:** O diferencial a copiar: rodar o NOSSO validador (CLT, cobertura mínima por turno, cota de fds, descanso pós-noturno) no momento da proposta de troca, não depois. Troca que quebra regra nem chega na mesa da Mariana.

### Shift bidding · leilão como mecânica para vagas indesejadas

No modelo de shift bidding, o gestor publica a vaga com data, horário, local, skills exigidas e condições; os profissionais dão lances/rankeiam preferências. Diferencial de pagamento ou PONTOS podem ser embutidos no lance para tornar noites e fins de semana atraentes sem obrigar ninguém. É descrito como 'válvula de pressão' em cima do processo core de escala — para buracos de rotina (PTO, faltas, picos sazonais), não para a montagem inteira.

*Fonte: https://rosterlab.com/blog/shift-bidding-guide-how-to-implement*

**Aplicação no HCB:** Para os slots cronicamente difíceis do HCB (noite de sábado, T-1/N-1 de feriado): quem pega buraco indesejado ganha 'crédito' — prioridade nos pedidos do mês seguinte ou abatimento na cota de fds. Formaliza a moeda de troca que hoje é favor informal.

### QGenda/symplr · folha de pagamento como derivado automático da escala

O módulo Time & Attendance do QGenda puxa da escala o job code, a localização e as pay rules de cada atribuição; quando a escala muda, os pay codes são atualizados automaticamente em tempo real para refletir a taxa correta. Integra com 20+ sistemas de payroll (Workday certificado, ADP, UKG/Kronos, Oracle...). O symplr Physician Scheduling segue o mesmo padrão: time tracking acomoda regras de compensação complexas de médicos e alimenta o payroll direto, com relatórios custom para planos de incentivo. Nenhum deles digita códigos à mão: o código é uma FUNÇÃO da célula da escala.

*Fonte: https://www.qgenda.com/time-and-attendance-providers/*

**Aplicação no HCB:** Os códigos numéricos do Senior devem ser gerados automaticamente da escala final ('as worked', pós-trocas), célula a célula, por uma tabela de mapeamento turno→código — nunca redigitados. Já temos isso parcialmente no script; a mudança é regenerar a cada alteração, não uma vez no fim.

### Reviews de QGenda · onde a automação quebra na prática

Reviews verificados (G2/Capterra/Software Advice) convergem: o auto-scheduler funciona bem com regras claras e simples, mas 'tem soluços cada vez que tentamos consertar' quando o conjunto de regras é muito intrincado — organizações com regras complexas relatam que a automação não segura todas as restrições ao mesmo tempo. A configuração administrativa de regras não-padrão é o ponto fraco número 1 apontado, junto com admin ruim em mobile. Médicos usuários finais, em contraste, avaliam bem o dia-a-dia (ver escala, pedir, trocar).

*Fonte: https://www.g2.com/products/qgenda-advanced-scheduling-for-providers/reviews*

**Aplicação no HCB:** Lição de design: o valor percebido está no SELF-SERVICE do médico (ver, pedir, trocar), não na sofisticação do otimizador. Para novembro: priorizar formulário de preferências + pool de buracos + trocas no app; manter o gerador Python simples com poucas regras ponderadas.

### MedRez · assistência slot a slot em vez de otimizador caixa-preta

Voltado a residências: médicos entram pedidos de folga/férias online; o admin concede as que cabem e recebe AVISO de conflito com rotações que não permitem férias. Na montagem, a ferramenta não gera tudo sozinha — ela destaca, enquanto o scheduler preenche, quais pessoas/turnos NÃO causariam conflito (staffing mínimo, tallies com metas, conflitos entre escalas), funcionando como copiloto slot a slot. Exporta ICS e PDF individual.

*Fonte: https://www.medrez.net/help/getting-started/overview/*

**Aplicação no HCB:** Modelo intermediário perfeito pro drag-and-drop que já existe em /ritmo/equipe: ao clicar num slot vazio, colorir os 66 nomes por elegibilidade (verde = passa em tudo, amarelo = fura preferência, vermelho = fura CLT/cobertura). Automação assistida sem depender de otimizador perfeito.

**Recomendações desta lente:**

- Substituir o e-mail livre por formulário de preferências com JANELA e prazo (ex.: dias 1-10 do mês anterior), limite de pedidos por pessoa e gradação 'não posso' vs 'preferia não' (modelo QGenda Rolling Request Limits + ByteBloc need-off/wish-off), validando cota de fds e CLT no momento da digitação.
- Tratar pedido submetido como célula bloqueada na geração (padrão QGenda/Lightning Bolt): o gerador monta 'como se' aprovado e a escalista só desbloqueia manualmente se a cobertura não fechar.
- Não perseguir automação 100%: até o Lightning Bolt (líder, 400+ regras/cliente) funciona como gerador de rascunho + revisão humana, e reviews confirmam que otimizadores quebram com regras intrincadas. Meta de novembro = rascunho sem buracos + revisão assistida.
- Formalizar 'preferência não é lei' como penalidade ponderada (modelo ShiftAdmin): violar preferência custa pontos que o gerador minimiza; violar CLT/cobertura é proibido. Regras do CONFIG viram pares min/max com peso.
- Vaga descoberta vira pool público 'plantões disponíveis' com notificação a todos os elegíveis (modelo Amion open shifts) — quem pega primeiro e passa no validador leva; acaba a convocação 1-a-1 por WhatsApp.
- Troca self-service com validação instantânea: proposta → validador CLT/cobertura roda na hora (modelo Petal) → aceite do colega → aprovação da Mariana (modelo Amion) → grade atualiza e marca o plantão como trocado, com histórico completo.
- Publicação: manter grade + PDF individual + códigos Senior (formatos que a equipe conhece) e adicionar feed ICS assinável por médico que se auto-atualiza (modelo Amion, 300 dias).
- Códigos Senior gerados automaticamente da escala 'as worked' (pós-trocas), regenerados a cada mudança — mapeamento célula→código como no Time & Attendance do QGenda; nunca redigitar.
- Na decisão planilha vs app: o mercado inteiro (QGenda, Lightning Bolt, Amion, ShiftAdmin, Petal, ByteBloc, symplr) é web app com self-service do médico — a planilha não sustenta trocas, pool de buracos nem notificações. Caminho híbrido recomendado: app React/Supabase para coleta de preferências, pool e trocas; motor Python continua como gerador/validador; planilha vira só formato de publicação/conferência.
- No editor drag-and-drop de /ritmo/equipe, adotar o modo copiloto do MedRez: ao focar um slot, colorir os médicos por elegibilidade (verde/amarelo/vermelho) usando o validador existente.


## 5 · Coleta de preferências e exportação

**Resumo.** O mercado de escala médica convergiu num mesmo desenho de coleta: pedidos TIPADOS, não texto livre — a distinção universal é "não posso trabalhar" (constraint dura) vs "prefiro não" (constraint mole) vs "quero trabalhar tal dia/turno", com cota validada no ato da submissão (QGenda bloqueia o pedido excedente e numera uma fila de espera) e janela com deadline. Texto livre só sobrevive como campo residual "observações"; a onda nova (MakeShift SmartRequests, RosterElf+ChatGPT) usa NLP para converter linguagem natural nesse mesmo schema tipado, sempre com aprovação humana antes de virar constraint. Na exportação, o trio que já usamos (grade do grupo + PDF individual + arquivo pro RH) é exatamente o padrão do mercado (ByteBloc imprime Main/Site/Individual/Blank), acrescido de UM item que não temos: feed ICS de assinatura por pessoa (Amion publica URL por médico, 300 dias à frente, atualização automática). Ninguém vende "mantenha a cara da sua planilha e ganhe validação por trás" — o que existe são add-ons de Sheets que validam in-place e serviços gerenciados opacos; nosso pipeline Python-gera-planilha JÁ É essa categoria, e a lacuna real está só na coleta de preferências e no ICS.

### Taxonomia de pedidos do ByteBloc: 5 tipos, hard vs soft, e cobrança de quem não enviou

O ByteBloc (escala de emergência desde 1989) estrutura TODA a coleta em 5 tipos: Need off (não consigo trabalhar — restrição RÍGIDA, o auto-scheduler nunca escala), Wish off (não quero, mas topo se faltar cobertura — restrição MOLE), Request on (quero este turno específico, com justificativa opcional; decisão final é do admin), Available (limpa marcações anteriores) e Times off (período de dias consecutivos, com recorrência semanal). Há atalhos de teclado (N+clique, W+clique, R+clique) direto na grade, campo 'Requested Workload' (quantas horas/turnos a pessoa quer no mês), motivos classificáveis (Vacation/Admin/CME/Personal) e ferramentas de gestão: 'Missing Requests' lista quem ainda não enviou pedidos e 'Requests History' loga toda mudança. Não há botão de submit — o pedido salva na hora; a moderação é do scheduler na montagem.

*Fonte: https://www.bytebloc.com/Help/Content/ShiftRequestsAdmin.htm*

**Aplicação no HCB:** É o schema pronto pro nosso formulário de novembro: os e-mails de texto livre da equipe do HCB se reduzem quase todos a esses 5 tipos. A distinção Need/Wish codifica exatamente a regra da casa 'preferência não é lei — cobertura ganha' (Wish off pode ser atropelado, Need off não). O 'Missing Requests' resolve a dor real de cobrar os ~66 médicos que não mandaram e-mail até o deadline; o 'Requested Workload' captura quem quer acelerar/desacelerar carga no mês.

### QGenda: cota validada na submissão + fila de espera numerada + aprovação assíncrona

O QGenda aplica 'Requesting Limits': o admin define quantos pedidos (ex.: dias de férias/ano, folgas/dia) cada pessoa pode fazer; se o médico pede além da cota, o sistema alerta e NÃO aceita o pedido. O 'Request Waitlist' numera sequencialmente os pedidos que excedem o limite diário (ex.: máximo 2 de folga por dia — o 3º e o 4º entram numerados na fila), e o scheduler pode aprovar da fila a critério. Após a validação automática de constraints, o admin pode exigir aprovação manual; pedidos e trocas ficam 'pending' sem prazo de expiração e são aprovados/rejeitados pelo web ou app (lista de Requests/Swaps com Approve/Reject por item).

*Fonte: https://www.qgenda.com/blog/integrated-management-vacation-request-limits/*

**Aplicação no HCB:** Ataca frontalmente o episódio das 33 pessoas acima da cota de FDS em outubro: a cota estava no CONFIG mas ninguém conferia — o padrão de mercado é validar NO MOMENTO do pedido, não na auditoria posterior. A fila de espera numerada é a mecânica certa pro 12/10 (feriado com N pedidos concorrentes de folga): ordem transparente em vez de negociação por e-mail.

### Amion: janela anual de requests que alimenta o auto-scheduler + alerta ao violar

No Amion, residentes/staff submetem requests online numa janela definida (tipicamente no início do ano/bloco), escolhendo em dois dropdowns: 'days' ou 'shifts' + 'can work' ou 'cannot work', marcando checkboxes num calendário e clicando Submit. Os pedidos sobem para o arquivo do OnCall (o desktop do scheduler) e ficam visíveis na grade; se o scheduler tenta escalar alguém num dia pedido como folga, o sistema alerta. Um request de férias pode ser 'convertido' em assignment real (vira 'Vac' na grade, com opção de escolher outra rotação e remover o request). No Amion Next, o fluxo é 'my schedule' → 'New Request' → tipo (PTO etc.).

*Fonte: https://whoison.net/cgi-bin/ocs?Page=Help:62*

**Aplicação no HCB:** Dois padrões úteis: (1) o pedido aprovado VIRA célula na grade (nosso esboço da escalista poderia pré-preencher 'FÉRIAS'/'FOLGA' como assignments bloqueados antes da montagem); (2) o alerta em tempo de montagem — no nosso caso, a aba de esboço da planilha (ou o drag-and-drop do /ritmo/equipe) deveria pintar a célula quando a atribuição colide com um pedido registrado.

### Estrutura de campos consagrada pro formulário de disponibilidade

O padrão documentado: identificação (nome, função, data de vigência) + grade semanal com os turnos REAIS da operação (não horários genéricos), cada célula marcável como Disponível/Indisponível/Preferido + restrições recorrentes com período de vigência (ex.: 'jan–mai: indisponível segundas de manhã') + mudanças temporárias com início e fim explícitos + máximo de horas/turnos desejados + campo de texto livre APENAS como último campo ('algo que não coube acima'). Boas práticas: uma página, 5–10 min para preencher, deadline explícito ('enviar até sexta 17h; escala sai segunda') e a regra de ouro de conformidade: respeitar o que foi coletado, senão o form morre.

*Fonte: https://shifton.com/blog/employee-availability-form/*

**Aplicação no HCB:** Blueprint direto do form de novembro: linhas = dias do mês (não semana genérica, pois plantão é por data), colunas = M/T/N do HCB, três estados por célula (bloqueio/prefiro não/quero), campo de férias com início-fim, campo 'quantos plantões quero' e texto livre residual. O deadline com data de publicação impressa é o que transforma a coleta por e-mail em processo.

### IA estruturando texto livre: MakeShift SmartRequests e o padrão 'IA propõe, humano aprova'

O SmartRequests (módulo do ShiftMate AI da MakeShift) usa NLP para entender pedidos escritos em linguagem natural — folga, troca, consulta de escala — e os transforma em dados estruturados que caem no fluxo normal de aprovação do gestor; o funcionário escreve como escreveria a um humano. O RosterElf documenta o arranjo complementar: ChatGPT como assistente externo que interpreta a linguagem natural, enquanto o sistema de escala permanece o 'system of record' para aprovações e publicação. Em nenhum produto a IA aprova ou escala sozinha: ela só converte texto em pedido tipado pendente.

*Fonte: https://blog.makeshift.ca/ai-staff-scheduling*

**Aplicação no HCB:** É exatamente a ponte pros e-mails da equipe do HCB: um endpoint que recebe o texto do e-mail (ou colagem da escalista) e devolve JSON no schema tipado (tipo de pedido, datas, turno, dureza), com tela de revisão antes de virar constraint — já temos a infra Anthropic no app (import de PDF/foto usa o mesmo padrão). Novembro pode rodar híbrido: quem preencher o form entra direto; quem mandar e-mail é parseado pra dentro do MESMO schema.

### Feed ICS de assinatura por pessoa (Amion): URL própria, 300 dias, atualização automática

No Amion, cada pessoa loga, clica 'My Schedule' e copia sua URL de assinatura de calendário; ao assinar no Google Calendar/iCal/Outlook, as mudanças da escala fluem automaticamente para o calendário pessoal — a assinatura transfere os compromissos de até 300 dias futuros e 2 semanas passadas, com refresh configurável. O MedRez oferece o mesmo via 'export to .ics' (com armadilha documentada: eventos gerados em GMT bagunçam o fuso se o gerador não cuidar do timezone). É export por PESSOA, não da grade inteira — cada médico só assina a própria escala.

*Fonte: https://support.amion.com/hc/en-us/articles/26561852130067-Calendar-Subscriptions*

**Aplicação no HCB:** É o entregável de maior valor percebido por médico e o mais barato de construir: um endpoint GET /api/ics?token=<médico> que serve o VTIMEZONE America/Sao_Paulo e os plantões da pessoa a partir do dado estruturado da escala. Substitui o PDF individual para quem vive no celular — e quando a escalista troca alguém, o calendário do médico atualiza sozinho, sem reenvio de PDF.

### Layouts de publicação do ByteBloc: o trio grade-do-grupo / individual / folha-de-ponto é o padrão

O ByteBloc imprime quatro formatos fixos: Main Schedule (calendário com todos os turnos de todos os sites), Site Main Schedule (um setor), Individual Schedule (todos os plantões de UM provider) e Blank Schedule (grade vazia para preenchimento manual), com exclusão seletiva de sites e inclusão dos Workload Requests no impresso; o próprio impresso serve como 'time reporting sheet' para conferência de folha. Não há template 100% customizável que imite o layout legado do cliente — os produtos oferecem variações do formato DELES, não do seu.

*Fonte: https://www.bytebloc.com/Help/Content/PrintedScheduleFormats.htm*

**Aplicação no HCB:** Valida que nossos 3 formatos (grade do grupo, PDF por médico, códigos pro RH) são o conjunto canônico — não falta um quarto formato, falta automatizar a geração dos três a partir de UMA fonte estruturada. E confirma que manter o layout que a equipe do HCB já reconhece é vantagem nossa sobre qualquer produto de prateleira: nenhum deles reproduz a planilha da casa.

### Export pra folha: QGenda 'schedule-first' com 20+ integrações de payroll

O QGenda Time and Attendance é 'schedule-first': o tempo trabalhado nasce associado ao tempo escalado na mesma plataforma, e o sistema puxa da escala, calcula (adicionais, diferenciais) e EXPORTA para o processador de folha — integrações prontas com ADP, Workday, UKG/Kronos, Paylocity, Dayforce, PeopleSoft, Lawson, NetSuite e Paychex. A mecânica é sempre: escala estruturada → motor de cálculo → arquivo/API no formato que o payroll consome; nenhum produto digita códigos manualmente no sistema de folha.

*Fonte: https://www.qgenda.com/time-and-attendance-nurse-and-staff/*

**Aplicação no HCB:** Nosso equivalente do 'processador de folha' é o Senior HCM. A lição de arquitetura: os códigos numéricos pro RH devem ser uma FUNÇÃO derivada do dado estruturado da escala (como já fazemos no script), nunca uma transcrição — e o próximo passo natural é descobrir qual formato o Senior do HCB aceita ingerir (achado seguinte).

### Senior HCM tem importação oficial de escalas por CSV (Integrador X) — com armadilhas

A documentação da Senior descreve o Integrador X (Gestão de Pessoas > Cadastros gerais > Integrador X > Importação de dados): fluxos temáticos com template CSV baixável por fluxo; o fluxo 'Escalas' dispara automaticamente os subfluxos Turmas da escala, Configurações da escala e Escalas do ponto, reutilizando campos do mesmo CSV; 'Horários' alimenta Escalas e exige códigos pré-cadastrados (FK validada). Formatos rígidos: datas DD/MM/AAAA, hh:mm com ou sem zero à esquerda, listas separadas por pipe, CPF com zeros à esquerda; validação bloqueia o LOTE inteiro se uma linha falhar, sem rollback parcial. No legado Vetorh existe a tela de Cadastro de Escalas (fr006esc) e Histórico de Escala (fr038hes).

*Fonte: https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/hcm/cadastros-gerais/integrador-x/importacao-dados/*

**Aplicação no HCB:** Pode eliminar a etapa mais braçal e sujeita a erro do fluxo do HCB: em vez de a escalista entregar códigos que o RH digita, nós geraríamos o CSV no layout do Integrador X (ou do módulo que o RH da OSS usa — verificar se é SeniorX ou Vetorh). Ação concreta pré-novembro: perguntar ao RH qual versão do Senior e se aceitam arquivo de importação de escala/histórico de escala; o gerador é ~1 dia de Python sobre o dado que já temos.

### Google Sheets como plataforma: add-on valida conflitos in-place e o padrão Form→Sheet→Apps Script

O add-on gratuito 'AI Shift Planner' (Workspace Marketplace) opera DENTRO do Sheets: recebe requisitos em texto livre ('Anna trabalha manhãs, 3 dias/semana'), gera a escala na própria planilha e — o mais relevante — 'valida instantaneamente escalas existentes no Sheets em busca de conflitos e erros'. No lado artesanal, o padrão consagrado é Google Form → aba de respostas → gatilho onFormSubmit em Apps Script que escreve o pedido na grade, manda e-mail ao aprovador com link de aprovar/negar e marca o status na planilha (implementações públicas: repo glucee/Time_Off_Request_Approve_System e tutorial de Christopher Enea; add-on comercial Form Approvals faz o roteamento sem código).

*Fonte: https://workspace.google.com/marketplace/app/ai_shift_planner/24208213221?hl=en*

**Aplicação no HCB:** É o caminho 'planilha mais inteligente' com custo mínimo: Google Form com o schema tipado (achado 1/4) despejando numa aba PEDIDOS da nossa planilha v4, e um onFormSubmit que pinta os bloqueios no esboço e roda o validador de cotas — a escalista continua no ambiente dela. Nosso validador CLT em Python já é mais forte que qualquer add-on; a decisão é só onde ele roda (script que regenera a planilha, como hoje, vs Apps Script residente).

### Ninguém vende 'mantenha sua planilha e ganhe validação por trás' — os substitutos são opacos ou totais

A pergunta (d) tem resposta negativa no mercado: os produtos (QGenda, Amion, ShiftAdmin, ByteBloc, Escala App) SUBSTITUEM a planilha pela grade deles; os serviços gerenciados (Thrawn com sua 'Scheduling Programming Language', Scheduling Wizard) operam como caixa-preta — 'envie suas constraints, devolvemos o cronograma pronto' — sem documentar formatos de entrada/saída nem garantir o layout do cliente; e os add-ons de Sheets validam in-place mas com motores rasos (sem CLT, sem equidade anual). O ShiftAdmin chega perto por dentro: 'Contracts' com regras por classe de médico, cada regra com point-values e penalidades, e requests marcáveis como FIXED — mas tudo dentro da UI dele. O Escala App (nascido no Einstein) é o player brasileiro: coordenador anuncia turnos vagos, profissional escolhe pelo celular, relatórios de planejado vs trabalhado para qualquer folha — de novo, na plataforma deles.

*Fonte: https://www.trythrawn.com/blog/physician-call-scheduling-software*

**Aplicação no HCB:** Reposiciona a decisão 'planilha inteligente vs app próprio': nosso pipeline (Python gera a planilha no layout da casa + validador CLT + exports) já ocupa um nicho que o mercado NÃO atende — somos o 'serviço gerenciado' transparente do HCB. O app /ritmo/equipe não precisa vencer a planilha como interface de publicação; precisa vencer o E-MAIL como interface de coleta. A arquitetura vencedora do mês: coleta tipada (form ou app) → dado estruturado → motor que já temos → publicação nos 3 formatos que a equipe reconhece + ICS.

**Recomendações desta lente:**

- Formulário de preferências com o schema tipado do mercado (ByteBloc): por data+turno, três estados — 'não posso' (hard), 'prefiro não' (soft), 'quero' — mais férias (início-fim), 'quantos plantões quero no mês' e texto livre SÓ como campo final; deadline impresso no form ('enviar até dia X, escala sai dia Y').
- Validar cota na submissão, não na auditoria (padrão QGenda): o form/app recusa pedido acima da cota de FDS/folgas e numera fila de espera transparente para dias concorridos (tipo feriado 12/10) — mata a classe de erro das '33 pessoas acima da cota'.
- Parser IA para o legado de e-mails: endpoint que converte texto livre no MESMO schema tipado (já temos a infra Anthropic do import de PDF/foto), com tela de revisão da escalista antes de virar constraint — padrão universal 'IA propõe, humano aprova'. Novembro roda híbrido: form pra quem aderir, parse pra quem insistir no e-mail.
- Entregar feed ICS por médico (endpoint GET tokenizado, VTIMEZONE America/Sao_Paulo, ~300 dias como o Amion): maior valor percebido por médico, custo baixo, e elimina reenvio de PDF a cada troca.
- Perguntar ao RH da OSS qual módulo Senior usam (SeniorX Integrador X vs Vetorh fr006esc) e se aceitam CSV de importação de escala/histórico — se sim, gerar o arquivo no layout deles substitui a digitação de códigos; atenção às regras do Integrador X: DD/MM/AAAA, códigos FK pré-cadastrados, lote inteiro falha sem rollback.
- Manter a planilha como interface de PUBLICAÇÃO (nenhum produto preserva o layout da casa — essa é nossa vantagem) e mover a inteligência pra COLETA: Google Form → aba PEDIDOS → onFormSubmit pinta bloqueios no esboço e roda validador, ou o /ritmo/equipe como coletor; a decisão planilha-vs-app se dissolve em 'dado estruturado no meio, planilha e app como vistas'.


## 6 · Complemento · pós-publicação, trocas e corte de folha

**Resumo.** O mercado resolve o pós-publicação com três mecanismos que se combinam: (1) escala "viva" com fonte única — no QGenda um swap aprovado atualiza a escala em tempo real em todos os lugares, sem conceito de republicação; (2) diff explícito contra snapshot — o Amion guarda uma cópia da versão publicada e marca cada célula alterada com setas azuis + tooltip de "quem estava antes", e notifica a equipe por e-mail só das mudanças; (3) camadas escalado-vs-trabalhado — o ByteBloc mantém versões As-scheduled / As-worked / Adjusted-as-worked e a folha consome a mais "real" disponível. Do lado Senior HCM, a competência fechada ("T - Totalizado") bloqueia recálculo e digitação; troca comunicada antes do corte entra como programação retroativa (Troca de Horário/Escala) com reapuração automática do ponto, e troca depois do corte vira Folha Complementar (tipo 12) na competência seguinte — ou seja, o divisor operacional do nosso ciclo é a data de corte do RH, que precisa virar configuração explícita do sistema.

### QGenda: não existe 'republicar' — a escala publicada é viva e o swap aprovado propaga em tempo real

O fluxo é: médico posta o plantão no Swap Market ou propõe troca direta; o outro médico recebe e-mail para aprovar/negar; conforme a configuração da instituição, a mudança ou entra direto na escala ou vai pro Schedule Owner dar aprovação final. Uma vez aprovada, 'once a schedule is changed in QGenda, the schedule is updated everywhere, on everyone's account, in real-time' — inclusive integrações downstream (Vocera) sincronizam na hora. O Swap Market só oferece o plantão a médicos elegíveis (credenciais, limites) e o claim é first-come-first-served com notificação imediata ao originador.

*Fonte: https://www.qgenda.com/blog/available-shifts-swap-market/*

**Aplicação no HCB:** Mata a ideia de 'republicar a planilha inteira': a planilha-fonte (ou o app) deve ser o ÚNICO lugar editável, e grade/PDF/códigos devem ser derivados dela por script, nunca editados à mão. Quem atualiza após a troca do dia 12 é sempre a fonte; os 3 formatos são regenerados, não corrigidos.

### Amion: snapshot na publicação + setas azuis de diff + tooltip com 'quem estava antes' — o diff é visual, não um reenvio

Ao publicar, o Amion armazena uma cópia do cronograma 'para comparar futuras versões contra o original'. Toda mudança posterior (do escalista OU troca negociada entre médicos) aparece anotada com setas azuis na célula; o cursor sobre a seta mostra quem estava originalmente escalado. O escalista pode 'rebatizar' o baseline clicando Track changes de novo (a versão atual vira o novo original). Complemento: 'Notify staff of updates' manda e-mail à equipe quando a escala muda, e swaps confirmados geram e-mail automático às duas partes e ao dono da escala.

*Fonte: https://support.amion.com/hc/en-us/articles/26155484839059-Track-changes (mecânica detalhada no espelho https://whoison.net/cgi-bin/ocs?Page=Help:23)*

**Aplicação no HCB:** É exatamente o mecanismo do nosso 'v2 vs v1 sem reenviar tudo': congelar um snapshot da grade no dia da publicação e gerar uma aba/quadro 'mudanças' automático (data, turno, saiu X, entrou Y, quando, por quem). A comunicação do meio do mês vira 'mudou isto' + link, não um novo PDF de 66 médicos.

### ByteBloc: separação formal 'As-scheduled' vs 'As-worked' vs 'Adjusted as-worked' — a folha consome a versão mais real disponível

O ByteBloc versiona a escala em camadas: Draft (proposta), As-scheduled (publicada), As-worked (reflete trocas e mudanças reais feitas por médicos e admins) e Adjusted as-worked (criada quando alguém mexe DEPOIS do grace period, preservando o As-worked original intacto — tipicamente ajuste de admin 'para fins de folha'). No módulo de payroll, a opção Auto computa a folha usando a primeira disponível na ordem: Adjusted as-worked → As-worked → As-scheduled → working revision mais recente. Ou seja: folha nunca é digitada; é sempre derivada da camada mais próxima do trabalhado.

*Fonte: https://www.bytebloc.com/Help/Content/PayrollConfiguration.htm (versões em https://www.bytebloc.com/Help/Content/EditVersion.htm)*

**Aplicação no HCB:** Modelo direto para os códigos do Senior: manter na planilha duas camadas — 'escalado' (congelado na publicação) e 'trabalhado' (acumula trocas). A exportação de códigos pro RH sai SEMPRE do 'trabalhado' na data de corte; o 'escalado' fica como registro histórico e base do diff. O grace period do ByteBloc equivale ao nosso corte de folha.

### Escala App (BR): troca pós-publicação com auto-aprovação por regra — o organizador só vê o que viola restrição

No produto brasileiro, o profissional solicita a troca pelo app; o organizador pode aprovar online OU habilitar aprovação automática: 'quando as trocas não infringem nenhuma restrição configurada, a ferramenta as aprova automaticamente'. A escala publicada fica acessível a todos no celular e os plantonistas recebem notificação push. O marketing deles quantifica a automação da aprovação como ~2 meses/ano de trabalho de gestor recuperado.

*Fonte: https://escala.app/blog/aplicativos-de-plantao-medico/*

**Aplicação no HCB:** Nosso validador CLT já é o motor de restrições — pode virar gate de auto-aprovação: troca que passa no validador (interjornada, 44h, cota de fds, cobertura mínima do turno) aplica direto na fonte e dispara o diff; troca que reprova cai na fila da escalista com o motivo. Isso tira a escalista do caminho feliz sem tirar o controle dela.

### Senior HCM: competência 'T - Totalizado' bloqueia recálculo — correção pós-fechamento é Folha Complementar (tipo 12), nunca reenvio

Quando o cálculo está Totalizado e a data do servidor é posterior à data de pagamento, o Senior IMPEDE o recálculo ('Você não pode calcular/digitar p/ processamentos anteriores, apenas emitir relatórios'); após geração de impostos e envio do líquido bancário, as bases não podem mais mudar. O caminho oficial para pagar diferença de competência encerrada é a Folha Complementar (tipo 12): um cálculo novo, na competência corrente, que apura só a diferença contra o que foi pago. (Reabrir para 'I - Inicializado' só é viável se nada posterior foi totalizado — na prática, antes do pagamento.)

*Fonte: https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/manual-processos/relacoes-trabalhistas/administracao-de-pessoal/calculo-folha.htm (bloqueio detalhado em https://suporte.senior.com.br/hc/pt-br/articles/4408636345364)*

**Aplicação no HCB:** Define a regra de negócio do nosso ciclo: troca comunicada ANTES do corte = corrige os códigos da competência normal; troca DEPOIS do corte = não se 'conserta' o envio — gera-se um relatório de ajuste que o RH lança como diferença/complementar no mês seguinte. O export pro Senior precisa carimbar cada linha com 'entra nesta folha' vs 'ajuste pós-corte'.

### Senior Gestão do Ponto: troca retroativa é cidadã de primeira classe — programação FR064THR/FR064TES com reapuração automática

O módulo de ponto do Senior tem telas específicas de programação provisória: Troca de Horário (FR064THR) e Troca de Escala (FR064TES), lançáveis individual ou coletivamente, retroativas ou futuras. Ao lançar a programação, a apuração do ponto do período é recalculada automaticamente e o histórico é mantido. Há duas travas configuráveis: 'dias limite para lançamento retroativo' (nas definições de Programações/Afastamentos) e 'Dias para expiração' (o 'dia expirado', que bloqueia acertos após N dias da apuração — corrigível só por lançamento coletivo no histórico de apurações).

*Fonte: https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/manual-processos/relacoes-trabalhistas/controle-de-ponto/manutencao-programacoes.htm (dia expirado: https://suporte.senior.com.br/hc/pt-br/articles/26421781479572)*

**Aplicação no HCB:** A troca do dia 12 comunicada até o corte NÃO é drama para o RH: é uma programação retroativa que o próprio Senior reapura sozinho. Vale perguntar ao RH do HCB quais são os valores configurados de 'dias limite retroativo' e 'dias para expiração' — esses dois números definem a janela real em que nosso diff ainda é barato de aplicar.

### Corte de folha na prática BR + eSocial: apuração 16→15 (ou 21→20), S-1200 até dia 15 do mês seguinte, retificação pós-S-1299 exige reabertura

A prática consolidada em empresas brasileiras é data de corte do ponto em ciclo 16-a-15 ou 21-a-20 'visando viabilizar o fechamento da folha em tempo hábil' (CLT art. 459 exige pagamento até o 5º dia útil). No eSocial, a remuneração (S-1200) deve ser transmitida até o dia 15 do mês subsequente OU antes do fechamento (S-1299); depois do S-1299, qualquer correção exige reabertura dos eventos periódicos (S-1298) e reenvio, e a retificação do S-1200 só é aceita se bater com o líquido do S-1210. Em hospitais públicos federais o pagamento de plantão exige confirmação da chefia de que o plantão foi cumprido antes de entrar na folha — o 'worked' é atestado, não presumido.

*Fonte: https://www.contabeis.com.br/artigos/3963/periodo-de-apuracao-de-ponto-e-pagamento-da-folha-do-mes-em-vias-de-esocial/ (retificação S-1200: https://centraldeatendimento.totvs.com/hc/pt-br/articles/360028334171)*

**Aplicação no HCB:** O HCB certamente tem uma data de corte formal (provável ciclo tipo 16→15). Ela deve virar CONFIGURAÇÃO do nosso sistema: cada troca ganha timestamp e o próprio export classifica — antes do corte entra nos códigos do mês, depois do corte cai num relatório separado 'ajustes pós-corte' que o RH trata como retroativo/complementar. Nunca reenviar o arquivo inteiro de códigos após o corte: só o delta, identificado.

**Recomendações desta lente:**

- Fonte única e formatos derivados: eleger a planilha (ou o app) como único lugar editável; grade do grupo, PDFs individuais e códigos Senior são SEMPRE regenerados por script a partir dela, com número de versão (v1, v2...) e data/hora no rodapé de cada formato — nunca corrigidos à mão.
- Snapshot na publicação + diff automático (à la Amion): congelar v1 no dia da publicação e manter uma aba 'mudanças' gerada automaticamente (data do plantão, turno, saiu X, entrou Y, quando foi trocado, quem autorizou). A comunicação do meio do mês é só o diff + link para a grade viva, não um reenvio completo.
- Duas camadas 'escalado' vs 'trabalhado' (à la ByteBloc): o escalado fica imutável após publicar; as trocas acumulam no trabalhado; a exportação de códigos pro Senior sai do trabalhado na data de corte. PDF individual só é reemitido para os médicos afetados pela troca.
- Data de corte do RH como configuração explícita: perguntar ao RH do HCB a data de corte da competência, o limite de dias para lançamento retroativo e os 'dias para expiração' do ponto no Senior. Troca com timestamp anterior ao corte entra nos códigos do mês; posterior ao corte gera automaticamente o relatório 'ajustes pós-corte' (candidatos a programação retroativa FR064THR/TES ou folha complementar tipo 12) — enviar só o delta, nunca o arquivo inteiro.
- Validador CLT como gate de auto-aprovação de trocas (à la Escala App): troca proposta que passa no validador (interjornada, teto 44h, cobertura mínima, cota de fds) aplica direto na fonte, dispara diff e notificação; troca que reprova cai na fila da escalista com o motivo exibido.
- Para a decisão planilha vs app: o ciclo pós-publicação (troca → validação → aplicar na fonte → regenerar 3 formatos → notificar diff) é o argumento mais forte a favor do app, porque planilha não tem trilha de auditoria por célula nem notificação nativa; se ficar na planilha, o mínimo viável é o snapshot v1 + aba de diff + regeneração por script a cada mudança.


## 7 · Complemento · coleta sem app instalado (Forms vs página própria)

**Resumo.** Google Forms puro não resolve validação contra estado vivo: o trigger onFormSubmit só roda DEPOIS que a resposta foi gravada, então o padrão real do ecossistema Forms é "aceitar tudo e reconciliar" (script reescreve opções/avisa estouro por email), com casos de corrida documentados quando dois médicos têm o form aberto ao mesmo tempo. Validação em tempo real de verdade exige página própria — e é exatamente o que o mercado de escala médica faz: portal web sem app instalado. O Supabase magic link fecha isso sem cadastro nem senha (signInWithOtp, link por email, expira em 1h), mas o SMTP embutido do Supabase manda só 2 emails/hora — precisa configurar SMTP próprio antes de novembro. Sobre adoção: ByteBloc "cobra" não-submissores com lembretes automáticos configuráveis (N dias antes, múltiplos) + lista de faltantes para o admin; a política padrão documentada do setor é "quem não envia até o prazo perde a vez e o gestor preenche" — não há punição, há default. Rollouts documentados recomendam piloto pequeno, comunicação com um ciclo de antecedência e um mês rodando em paralelo com o canal antigo.

### onFormSubmit não bloqueia submissão — roda depois que a resposta já foi gravada

O trigger instalável de form submit do Apps Script dispara quando o usuário responde, mas a resposta já está armazenada quando o script executa — não existe hook de pré-validação que rejeite o envio. A validação nativa do Forms é por campo (regex, número), sem operações lógicas nem lookup em dados externos. Portanto qualquer 'validação de cota na submissão' em Google Forms é na verdade pós-validação: o script confere contra a planilha e reage (email automático ao médico avisando que a 3ª folga estourou a cota, marcação da linha para a escalista).

*Fonte: https://developers.google.com/apps-script/guides/triggers/installable*

**Aplicação no HCB:** Se a coleta de novembro for por Google Forms, o desenho correto é 'aceitar e reconciliar': confirmação automática por email a cada envio (com o que foi aceito e o que estourou), nunca prometer bloqueio na hora. Isso é aceitável para preferências (que não são lei — cobertura ganha), mas é inferior à página própria.

### Padrão Form→Sheet→Apps Script com cota: COUNTIF + setChoiceValues, com corrida documentada

Mecânica documentada: uma aba com colunas Opção/Cota/Restante, onde Restante = cota − COUNTIF sobre a aba de respostas; um trigger onFormSubmit reescreve as escolhas do item MULTIPLE_CHOICE via setChoiceValues() só com opções de Restante > 0. Limitações explícitas do autor: o script fica 'a few seconds behind' após cada envio, e formulários já abertos em outros navegadores NÃO atualizam ao vivo — dois médicos com o form aberto escolhem a mesma vaga e ambos entram. Add-ons de marketplace (Form Choice Limiter, Choice Eliminator) empacotam a mesma mecânica e herdam a mesma janela de corrida; um deles só contorna isso roteando respostas por URL própria fora do Forms nativo.

*Fonte: https://www.pbainbridge.co.uk/2019/04/dynamically-remove-google-form-options.html*

**Aplicação no HCB:** Com 66 médicos submetendo perto do deadline (comportamento típico), a janela de corrida é real. Usável só se cota for tratada como soft limit + reconciliação pela escalista — que é como a escala funciona hoje de qualquer jeito. Não usar add-on de terceiros com dados de escala do hospital.

### Validação em tempo real de verdade = servir um form HTML próprio, não Google Forms

O workaround canônico da própria comunidade Apps Script para validar contra estado vivo é abandonar o Forms e servir um web app (HTML Service) cujo JavaScript consulta a planilha no momento do envio via google.script.run e só grava se a cota ainda existe — validação server-side no clique de enviar, sem janela de corrida relevante. Ou seja: mesmo dentro do ecossistema Google, a resposta para 'cota viva' é uma página web própria, não o Forms.

*Fonte: https://www.bazroberts.com/2017/11/04/apps-script-basics-15-form-validation/*

**Aplicação no HCB:** Isso elimina a falsa economia de 'ficar no Google é mais simples': para ter validação viva teria que se escrever um web app Apps Script do zero — enquanto já existe um app React/Supabase em produção com a escala carregada. A página própria em /ritmo é estritamente menos trabalho que o web app Apps Script equivalente.

### Supabase magic link: acesso sem cadastro, sem senha e sem app instalado

signInWithOtp envia por padrão um magic link por email (ou código de 6 dígitos se o template usar {{ .Token }} — melhor em celular, sobrevive a preview de link de antivírus corporativo). O link expira em 1 hora e cada email só pode pedir 1 link a cada 60s. Com shouldCreateUser: false e os 66 emails pré-cadastrados (via Admin API), ninguém 'se cadastra' — o médico digita o email que já usa, clica no link e cai logado na página de preferências, com sessão persistida (access + refresh token). Funciona em qualquer navegador de celular, zero instalação.

*Fonte: https://supabase.com/docs/guides/auth/auth-email-passwordless*

**Aplicação no HCB:** É o caminho de menor atrito para a página de preferências em /ritmo: a escalista manda 1 link por WhatsApp/email, o médico entra com o próprio email, vê as cotas vivas (dias já lotados, fds já consumido) e a validação roda contra o Postgres na submissão — o problema que o Forms não resolve.

### ARMADILHA: o email embutido do Supabase manda 2 mensagens/hora — magic link em produção exige SMTP próprio

O serviço SMTP padrão do Supabase está limitado a 2 mensagens por hora e só entrega para endereços de membros da organização — explicitamente 'not meant for production use'. Com SMTP customizado (Resend, SES, etc.) o limite inicial sobe para 30 mensagens/hora, ajustável na página de Rate Limits do projeto. Sem isso, 66 médicos pedindo magic link na semana do deadline simplesmente não recebem o email.

*Fonte: https://supabase.com/docs/guides/auth/auth-smtp*

**Aplicação no HCB:** Pré-requisito técnico número 1 se o caminho for a página no app: configurar SMTP próprio e subir o rate limit ANTES de anunciar o form à equipe. Alternativa que elimina o email na hora do acesso: gerar 1 URL tokenizada por médico (token longo na query, validado por edge function) e mandar pela própria escalista — o médico nem digita email.

### ByteBloc 'cobra quem não enviou' = lembretes automáticos escalonados + lista de faltantes pro admin, sem punição

Na documentação oficial: o admin 'seleciona o número de dias de antecedência em que um lembrete deve ser enviado aos providers que ainda não submeteram requests'; pode configurar múltiplos lembretes (ex.: D-7, D-3, D-1) e a cada disparo o admin recebe um email com a lista nominal dos faltantes. Cada provider também configura seus próprios lembretes. Os limites (máx. dias off, máx. fds off, need-off vs wish-off por escala) são validados pelo sistema por provider. Não há consequência automatizada para quem não envia — a cobrança é social/da escalista, munida da lista.

*Fonte: https://www.bytebloc.com/Help/Content/ProviderRequests.htm*

**Aplicação no HCB:** Replicável em 1 dia com o que já existe: cron (Vercel/GitHub Actions) que compara os 66 nomes contra as submissões no Supabase (ou na aba de respostas) e manda em D-7/D-3/D-1 (a) lembrete individual aos faltantes e (b) lista nominal para a escalista. É exatamente o 'cobrando como' que a lacuna perguntava.

### Política padrão do setor para não-submissores: perde a vez e o gestor preenche

Guia de política de self-scheduling de enfermagem (PayPro): 'Anyone who fails to enter their hours by the deadline loses their chance to request hours and instead will be entered by the schedule manager' — quem não envia até o prazo é escalado pelo gestor, sem preferências, com deadlines 'posted for all nurses to see'. Rollouts documentados complementam: deadline claro após o qual a gestão fecha os buracos, e preferência a critérios objetivos (senioridade/equidade) nos ajustes. Não é punição: é um default previsível e publicado.

*Fonte: https://payprocorp.com/resources/blog/the-complete-guide-to-writing-a-nurses-self-scheduling-policy/*

**Aplicação no HCB:** Dá texto pronto para a regra de novembro, alinhado com 'preferência não é lei': 'quem não enviar até o dia X será escalado conforme o padrão histórico e a equidade anual, sem garantia de preferências'. Como o gerador já usa histórico + equidade, o não-submissor não trava nada — só perde influência. Publicar isso junto com o link é o que torna o deadline crível.

### Rollout documentado: piloto pequeno, revisor de prontidão, e canal antigo aberto durante a transição

O guia de implantação da When I Work recomenda: confinar o trial a uma unidade pequena antes de expandir; manter 'a schedule reviewer on standby' para resolver conflitos durante o piloto; canais de suporte abertos; e comunicar a política 'clearly and promptly' assim que definida. Política real de hospital (Univ. of Phoenix, doc de nursing scheduling) fixa pedidos por escrito com 1 mês de antecedência e escala publicada em blocos de 4 semanas — ou seja, o ciclo de coleta→publicação de ~30 dias que vocês já praticam é o padrão. O estudo acadêmico de 9 meses (arXiv 2102.02132) documenta que o uso de sistemas de self-scheduling é DESIGUAL por personalidade e posição social no grupo — parte da equipe sempre usará menos, e o sistema deve apoiar práticas pró-sociais (trocas, acomodação) em vez de competição por vagas.

*Fonte: https://wheniwork.com/blog/nurse-self-scheduling*

**Aplicação no HCB:** Plano de migração realista para 4 semanas: (1) piloto com 5-8 médicos próximos da escalista na 1ª semana; (2) anúncio ao grupo com a política de deadline; (3) novembro híbrido — form é o canal oficial, mas email ainda aceito e a ESCALISTA transcreve no próprio form (ela é o fallback de primeira classe, não uma exceção); (4) dezembro só-form. Não esperar 100% de adesão no 1º mês — esperar 60-80% e cobrar o resto com a lista de faltantes.

### Planilha protegida com validação in-place NÃO fecha: sem permissão por linha e sem cota cross-user

Sheets suporta protected ranges com editores específicos por faixa, mas não existe permissão condicional por linha baseada em quem edita — seria preciso criar e manter manualmente 66 protected ranges (uma por médico, com o email dele como único editor). Data validation com 'reject input' só valida a célula isolada (formato, lista), não uma cota consumida por outros usuários; cota cross-user vira no máximo formatação condicional (aviso visual que não impede nada). Cada saída/entrada de médico exige reconfigurar ranges à mão.

*Fonte: https://support.google.com/docs/answer/1218656*

**Aplicação no HCB:** Descartar a opção 'planilha protegida onde cada médico preenche sua linha' como mecanismo de coleta: o custo de manutenção de 66 ranges + a ausência de validação real de cota a tornam pior que o Forms E pior que a página no app. A planilha continua ótima como saída (publicação), não como entrada.

**Recomendações desta lente:**

- Caminho recomendado para novembro: página /ritmo/preferencias no app existente, acessada por magic link Supabase (signInWithOtp com shouldCreateUser:false e os 66 emails pré-criados via Admin API) ou por URL tokenizada individual distribuída pela escalista — zero instalação, zero senha, validação de cota contra o estado vivo do Postgres na submissão.
- Pré-requisito antes de qualquer anúncio: configurar SMTP customizado no Supabase (Resend/SES) e subir o rate limit — o embutido entrega 2 emails/hora e só para membros da org; 66 médicos na semana do deadline não funcionam nisso.
- Se a decisão for ficar no Google por um ciclo: tratar cota como soft limit — Forms + onFormSubmit que confere contra a planilha e responde email automático de confirmação/estouro; nunca prometer bloqueio na hora (onFormSubmit roda pós-gravação e forms abertos não atualizam ao vivo).
- Cobrança de não-submissores (padrão ByteBloc, replicável em 1 dia): cron em D-7/D-3/D-1 que diffa os 66 nomes contra as submissões e manda lembrete individual aos faltantes + lista nominal para a escalista.
- Publicar a política junto com o link, no texto padrão do setor: quem não enviar até o dia X é escalado conforme padrão histórico e equidade anual, sem garantia de preferências — default previsível, não punição.
- Migração em 4 semanas: piloto com 5-8 médicos próximos → anúncio com política → novembro híbrido (form oficial, email ainda aceito com a escalista transcrevendo no próprio form como fallback de primeira classe) → dezembro só-form. Planejar para 60-80% de adesão no 1º mês, não 100%.
- Descartar a variante 'planilha protegida onde cada um edita sua linha': 66 protected ranges manuais, sem cota cross-user real — pior que as duas outras opções como canal de entrada. Planilha segue como formato de SAÍDA/publicação.


## 8 · Complemento · inviabilidade explicada (o mês que não fecha)

**Resumo.** O caminho triste tem mecânica oficial e madura: no CP-SAT, cada restrição relaxável ganha um enforcement literal (only_enforce_if), esses literais entram como assumptions, e após INFEASIBLE o solver devolve sufficient_assumptions_for_infeasibility() — um subconjunto reduzido (não garantidamente mínimo) das restrições em conflito, com duas ressalvas práticas: exige num_workers=1 e devolve índices que você mapeia de volta pra nomes legíveis. Para explicação ORDENADA e acionável, o instrumento certo não é o MUS ("estas regras juntas são impossíveis") e sim o MCS ponderado ("solte estas, que fecha") — o CPMpy já embala isso pronto sobre OR-Tools (mus, quickxplain com ordem de preferência, mcs_opt com pesos, marco para enumerar alternativas). Em produção, a prática dominante é nem deixar o INFEASIBLE acontecer: modelo elástico com slack penalizado por família de regra, em que os slacks positivos SÃO o relatório ("faltou 1 pessoa no noturno do dia 12" ou "cota de fds de X estourou em 1"). Timefold é o contraste: ScoreAnalysis explica a solução que existe (quais restrições quebradas, por quem), mas o mantenedor é explícito que metaheurística não prova nem explica inviabilidade — só CP-SAT dá prova. Sobre tempo: nossa instância (66×30×3 ≈ 6 mil booleans de atribuição) é pequena pro estado da arte — relato real de 150 funcionários×30 dias×50 tipos de turno resolve em 2–5 min, e instância de benchmark com 60 funcionários×4 semanas foi provada ótima por MIP — então o solve fica em segundos e a explicação MUS/MCS em minutos.

### Mecânica oficial do CP-SAT para explicar inviabilidade: enforcement literal + assumptions + sufficient_assumptions_for_infeasibility

A documentação oficial do OR-Tools descreve o fluxo em 3 passos: (1) criar um BoolVar indicador por restrição relaxável e envolver a restrição com .only_enforce_if(b); (2) registrar os indicadores com model.add_assumptions([b1, b2, ...]); (3) se o status vier INFEASIBLE, chamar solver.sufficient_assumptions_for_infeasibility(), que devolve os índices das variáveis-assumption responsáveis pelo conflito — os índices apontam para model.proto.variables[i].name, então nomear o indicador descritivamente é o que torna a saída legível. Duas limitações documentadas: o conjunto é 'minimized but not guaranteed to be minimal' (heurístico, pode vir com folga), e 'solving with assumptions is not compatible with parallelism. Therefore, the number of workers must be set to 1' — o explicador roda single-thread, mais lento que o solve normal.

*Fonte: https://github.com/google/or-tools/blob/stable/ortools/sat/docs/troubleshooting.md*

**Aplicação no HCB:** No nosso gerador Python, cada regra relaxável vira um literal nomeado em português: 'cota_fds_LAURA', 'teto_44h_MURILO', 'preferencia_sem_noturno_SELMA', 'cobertura_N_dia_12'. Quando novembro não fechar, a escalista recebe a lista desses nomes em vez de 'não achou solução'. Cobertura mínima fica FORA das assumptions (sempre hard) se a política for 'buraco jamais' — aí o conflito aparece nas outras regras.

### Conjunto reduzido ≠ mínimo: MUS de verdade se obtém minimizando a soma (ponderada) dos literais

Tanto o troubleshooting oficial quanto o CP-SAT Primer avisam: para um Minimal Unsatisfiable Set real, não use a API de assumptions — troque por um problema de otimização: maximize a soma dos indicadores satisfeitos (equivalente a minimizar quantas regras precisam ser desligadas). Com pesos, isso vira diretamente 'qual o conjunto MAIS BARATO de regras a soltar', que é a pergunta da escalista. O Primer traz o exemplo de código completo com indicadores nomeados ('Constraint 1') e o loop de impressão dos nomes via model.proto.

*Fonte: https://d-krupke.github.io/cpsat-primer/parameters.html*

**Aplicação no HCB:** Pesos em ordens de grandeza viram nossa hierarquia já validada no projeto (cobertura > CLT > cota de fds > preferência): preferência peso 1, cota de fds peso 100, teto CLT peso 10.000. O ótimo desse modelo responde 'o jeito mais barato de fechar novembro é liberar a cota de fds de 2 pessoas' em uma única rodada de solve — sem loop de tentativa e erro.

### CPMpy embala MUS/QuickXplain/MCS/MARCO prontos rodando sobre OR-Tools

O pacote cpmpy.tools.explain traz as quatro ferramentas com solver='ortools' por padrão: mus(soft, hard) — MUS deletion-based usando assumptions + unsat core; quickxplain(soft, hard) — MUS *preferido* segundo a ordem em que você lista as restrições (algoritmo de Junker); mcs(soft, hard) e mcs_opt(soft, hard, weights) — Minimal Correction Subset, o conjunto (de custo mínimo, na variante opt) cuja remoção torna o modelo satisfazível; marco() — enumera TODOS os MUSes/MCSes alternando um map-solver de hitting set. A distinção que resolve o problema de UX: MUS explica o conflito ('estas 5 regras juntas são impossíveis'), MCS prescreve o conserto ('solte estas 2 que fecha').

*Fonte: https://cpmpy.readthedocs.io/en/latest/api/tools/explain.html*

**Aplicação no HCB:** Não precisamos implementar nada disso na mão: dá pra manter o modelo CP-SAT atual e montar uma casca CPMpy só pro explicador, ou portar o modelo. quickxplain com a lista ordenada [preferências..., cotas_fds..., CLT...] devolve a explicação que respeita nossa hierarquia; mcs_opt com pesos devolve a sugestão de relaxamento. Se a escalista rejeitar a primeira sugestão, marco() enumera as alternativas ('ou libera a cota de X, ou convoca +1 no turno Y').

### A sugestão 'convoque +1 pessoa no turno Y' se obtém modelando a convocação extra como slack com custo — modelo elástico que nunca retorna INFEASIBLE

A prática de produção relatada na lista do OR-Tools (implementação real com 150–300 funcionários) não usa o caminho INFEASIBLE: toda regra potencialmente conflitante vira soft com penalidade calibrada — 'coverage gaps (10k), missing days off (1.5k), weekend guarantees (5k)' — e o status é sempre OPTIMAL/FEASIBLE. Os slacks positivos da solução ótima são o próprio relatório do mês que não fecha: cada unidade de slack de cobertura é literalmente 'falta 1 pessoa neste turno deste dia', e cada estouro de cota é 'fulano passou da cota em N fds'. A explicação vem de graça na solução, sem segunda rodada de solve e sem a limitação de num_workers=1.

*Fonte: https://groups.google.com/g/or-tools-discuss/c/u2pm4Io4R-w*

**Aplicação no HCB:** É o desenho recomendado pro fluxo mensal do HCB: o solver SEMPRE entrega uma grade + uma lista 'o que não fechou e por quanto' (ex.: mês de 5 sábados → slack de +2 nas cotas de sábado OU 2 buracos de cobertura, conforme os pesos). A escalista decide entre as alavancas em vez de receber um erro. O explicador MUS/MCS fica como segundo nível, pra quando ela perguntar 'mas POR QUE não fechou?'.

### Timefold/metaheurística não explica inviabilidade — ScoreAnalysis explica a solução dada, e o padrão para 'não fecha' é o buraco explícito (allowsUnassigned)

O ScoreAnalysis (SolutionManager.analyze) decompõe o score por restrição: constraintMap() diz quais restrições estão quebradas, quantas vezes, e quais entidades (médico/plantão) causam cada violação — excelente para auditar uma grade existente. Mas na discussão oficial sobre problemas over-constrained o mantenedor (triceo) é explícito: o solver 'infelizmente não pode dizer por que algo não aconteceu' — metaheurística não produz prova de inviabilidade nem núcleo de conflito. O padrão recomendado é allowsUnassigned=true na planning variable: em vez de quebrar hard constraint, o solver deixa o plantão VAZIO e penaliza o vazio no score, e o diagnóstico fino se faz por simulação manual (fixar a atribuição suspeita e re-analisar o score).

*Fonte: https://github.com/TimefoldAI/timefold-solver/discussions/1617*

**Aplicação no HCB:** Pesa direto na decisão planilha-inteligente vs app: o app React/Supabase com drag-and-drop casa bem com o padrão Timefold (buraco explícito + análise por restrição da grade atual), mas se queremos a frase 'novembro não fecha porque X, e o conserto mais barato é Y' com prova matemática, isso só o CP-SAT dá. Os dois se combinam: CP-SAT como motor/auditor, app como superfície de edição.

### Benchmark de tamanho igual ao nosso: 60 funcionários × 4 semanas × 10 turnos é instância PROVADAMENTE resolvível por solver exato

Nas instâncias públicas de Curtois & Qu (schedulingbenchmarks), a Instance 12 tem exatamente nossa escala — 60 funcionários, 4 semanas, 10 tipos de turno — e foi resolvida até o ótimo provado (valor 4.040) tanto por Gurobi quanto por branch-and-price; a Instance 11 (50 funcionários, 4 semanas, 6 turnos) idem (3.443). Já os solvers maxSAT com 4 horas de limite ficaram 4–7× acima do ótimo, mostrando que a escolha da tecnologia importa: MIP/CP exato domina nessa faixa de tamanho. Nosso caso (66 médicos × 30 dias × 3 turnos ≈ 6.000 variáveis booleanas de atribuição) está na faixa mais fácil desse espectro.

*Fonte: https://pmc.ncbi.nlm.nih.gov/articles/PMC6394591/*

**Aplicação no HCB:** Elimina o medo de que o otimizador seja lento demais pro fluxo mensal: a instância do HCB está abaixo do tamanho que solvers exatos fecham até o ótimo. Solve interativo (segundos a poucos minutos) é expectativa realista, o que permite botão 'refazer' na planilha ou no app sem fila de processamento.

### Referências de tempo real: 150 funcionários × 30 dias × 50 turnos em 2–5 min no CP-SAT; INRC-II dava ~20 min por semana para 60 enfermeiros

Implementação real relatada na lista do OR-Tools: com variáveis booleanas assign[e,d,s], hard constraints (1 turno/dia, descanso de 11h, qualificação, ausências) e objetivo soft ponderado, '150 employees, 30 days and 50 shift types' resolve em '2 to 5 minutes' e '300+ employees take 10 to 30 minutes'. Como régua acadêmica, a competição INRC-II usava instâncias de {30,40,50,60,80,100,120} enfermeiros em horizontes de 4/8 semanas e concedia 'approximately 10+30*(N-20) seconds' por estágio de 1 semana — para N=60, ~20 min por semana — e os competidores (branch-and-price, simulated annealing) entregavam boas soluções dentro disso em 2015; hardware e solvers de 2026 são substancialmente mais rápidos.

*Fonte: https://ar5iv.labs.arxiv.org/html/1501.04177*

**Aplicação no HCB:** Orçamento de tempo pro nosso pipeline de novembro: solve principal com time limit de 60–120 s já deve saturar a qualidade (instância 5–15× menor que a do relato de 2–5 min); a rodada de explicação (single-thread por causa das assumptions, ou deletion-based MUS ≈ 1 solve por restrição candidata) cabe em minutos se os literais forem por FAMÍLIA (dezenas) e não por célula (milhares). Granularidade dos literais é a decisão de engenharia que controla esse custo.

### UNSAT core por assumptions existe no OR-Tools desde a v8.2 e o CPMpy documenta o fluxo completo de debugging

A página de unsat core do CPMpy confirma que 'Since version 8.2, OR-Tools supports declaring assumptions, and extracting an unsat core' com interface estilo PySAT: s.solve(assumptions=[...]) seguido de s.get_core(). O guia 'How to debug' do CPMpy organiza o processo em pipeline: primeiro verificar se o modelo é UNSAT mesmo (e não bug de modelagem), depois extrair core/MUS sobre as restrições SOFT mantendo as estruturais como hard, e só então decidir relaxamento — com a observação de que MSSes ponderados 'can be calculated optimally using a Max-CSP formulation', ou seja, a ordenação de relaxamentos é um problema de otimização bem-posto, não uma heurística de UX.

*Fonte: https://cpmpy.readthedocs.io/en/latest/unsat_core_extraction.html*

**Aplicação no HCB:** Define a arquitetura do explicador em camadas pro nosso script: (0) pré-validador aritmético que já temos (oferta de sábados × demanda — pega o mês de 5 sábados sem solver nenhum); (1) solve elástico que sempre entrega grade + slacks; (2) get_core/MUS sob demanda para a pergunta 'por quê'; (3) marco/mcs_opt para listar consertos alternativos ordenados por custo. Cada camada é mais cara e mais rara que a anterior.

**Recomendações desta lente:**

- Adotar o desenho de duas camadas: solve principal ELÁSTICO (slack penalizado por família de regra — cobertura, cota fds, teto CLT, preferências — com pesos em ordens de grandeza 10^0/10^2/10^4) que nunca retorna INFEASIBLE e cujos slacks positivos são o relatório 'o que não fechou e por quanto'; explicador MUS/MCS como segunda rodada opcional para a pergunta 'por quê'.
- Nomear enforcement literals em português e por unidade acionável ('cota_fds_LAURA', 'cobertura_N_dia_12', 'teto_44h_MURILO'): o retorno de sufficient_assumptions_for_infeasibility() são índices de variáveis, e o nome do literal é a única coisa entre o solver e uma mensagem legível pra escalista.
- Usar granularidade por família/pessoa (dezenas de literais), não por célula da grade (milhares): o custo do MUS deletion-based é ~1 solve por literal candidato e assumptions forçam num_workers=1 — com dezenas de literais a explicação sai em minutos, com milhares vira hora.
- Traduzir o MCS ponderado (cpmpy mcs_opt, ou minimizar soma ponderada dos literais direto no CP-SAT) nas duas alavancas reais da escalista: 'liberar a cota/preferência de X' (literal de regra) e 'convocar +1 no turno Y' (slack de cobertura com custo alto). marco() enumera alternativas quando a primeira sugestão for rejeitada.
- Manter o pré-validador aritmético ANTES do solver (oferta × demanda de sábados/turnos, como a memória do projeto já registra pro mês de 5 sábados): conflito de contagem pura é detectável em milissegundos com mensagem exata, e reserva o explicador caro pros conflitos não óbvios (interação cota × feriado × férias).
- Calibrar expectativa de tempo: solve principal do HCB (66×30×3) com time limit de 60–120 s; benchmark real de 150×30×50 fecha em 2–5 min e instância pública de 60 funcionários×4 semanas tem ótimo provado — nosso caso é interativo, cabe num botão 'remontar' da planilha ou do app.
- Na decisão planilha vs app: o motor de explicação é agnóstico de interface (roda no script Python que já gera a planilha), então a decisão de UI não bloqueia esta lacuna; se o app absorver o solver, evitar o caminho Timefold-only para inviabilidade — metaheurística não produz prova nem núcleo de conflito (confirmado pelo mantenedor), então CP-SAT permanece como motor/auditor e o ScoreAnalysis-style fica pra auditar grades editadas à mão.


## 9 · Complemento · Senior G5: do 'existe' ao payload

**Resumo.** O canal Senior saiu do "existe" para o payload: o WS SOAP `com.senior.g5.rh.hr.programacaoColetiva` está documentado campo a campo na linha 6.10.x do HCM G5, e a operação que encaixa no nosso caso é `Horario` — numEmp + data (datIni, DD/MM/YYYY) + código do novo horário (novHor) + abrangência por matrícula (abrCad), com a regra explícita de que troca de horário vale 1 dia (perfeito para grade dia a dia). Autenticação vai no corpo SOAP (user/password/encryption; 0=texto aberto, 2=token Senior) e o retorno síncrono traz um único campo `erroExecucao` por chamada — ou seja, "tratamento de erro por linha" se obtém granularizando: 1 chamada = 1 médico-dia (~2.000 chamadas/mês, trivial para o pipeline Python atual). A tela Programações Coletivas NÃO importa arquivo no G5 — sem o WS, "export no formato da casa" continua sendo digitação do RH. O HCB/ICIPE comprovadamente roda Senior HCM G5 (vaga exige LSP, SGU, Controle de Ponto), mas a versão exata e a URL do middleware não são públicas: o gargalo real é a TI liberar a URL do `g5-senior-services` e um usuário de integração no SGU com permissões (artigo oficial manda grupo Admin — pedir grupo dedicado de integração).

### WSDL e operações do programacaoColetiva: spec completa, campo a campo

O serviço expõe 14 operações (Horario, Escala, Ponte, Compensacao, HoraExtra, ProjetarHorario, Convocacao, Rateio, Permissao, SobreAvisoProntidao, Local, CentroCusto, Parada, AutorizacaoSaida) em 3 modos, com WSDL no padrão http(s)://<servidor>/g5-senior-services/ronda_Synccom_senior_g5_rh_hr_programacaoColetiva?wsdl (e ronda_Async.../ronda_Scheduled...). A operação Horario (troca de horário coletiva) recebe: numEmp (obrigatório), datIni DD/MM/YYYY (obrigatório), novHor = código do novo horário (obrigatório), datFim, tipOpe I/E (incluir/excluir, default I), e 17 parâmetros de abrangência (abrEmp, abrCad = matrículas, abrFil, abrLoc, abrEsc, abrHor etc.) que delimitam QUEM recebe a programação. Retorno: um único campo erroExecucao (nulo/vazio = sucesso). Nota literal da doc: troca de horário vale somente 1 dia — para vários dias, uma troca por dia ou troca de escala.

*Fonte: https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/webservices/com_senior_g5_rh_hr_programacaocoletiva.htm*

**Aplicação no HCB:** Responde a pergunta central: matrícula + data + código de horário basta? Sim — mais numEmp e credenciais. Nossa grade de novembro (66 médicos × dias × turno) vira uma sequência de chamadas Horario com abrCad restrito à matrícula (ou agrupando matrículas que compartilham o mesmo dia+código). A restrição de 1 dia por troca é exatamente o nosso modelo de plantão dia a dia.

### Alternativa por matrícula: historicos.Escala (e historicosColetivos)

O WS com.senior.g5.rh.hr.historicos tem a operação Escala que grava histórico de escala POR COLABORADOR: numEmp, tipCol (1=empregado), numCad (matrícula), datAlt (data da alteração), codEsc (código da nova escala), codTma (turma), tipOpe I/A/E. Endpoints ronda_Sync/Async/Scheduledcom_senior_g5_rh_hr_historicos?wsdl. Serve para trocar a escala-base do colaborador (a tabela de revezamento cadastrada), não o horário pontual do dia. Existe ainda com.senior.g5.rh.hr.historicosColetivos na mesma linha de doc.

*Fonte: https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/webservices/com_senior_g5_rh_hr_historicos.htm*

**Aplicação no HCB:** Se o RH do HCB modela plantonista com escala cadastrada e turma (em vez de horário dia a dia), o export correto é historicos.Escala por matrícula. Precisamos perguntar ao RH qual das duas entidades eles digitam hoje: código de HORÁRIO por dia (→ programacaoColetiva.Horario) ou código de ESCALA (→ historicos.Escala). Os 'códigos numéricos pro RH' que já geramos devem bater com uma das duas tabelas.

### Autenticação e modos de execução: síncrono é o único com erro por chamada

Todo WS G5 leva user, password e encryption no corpo SOAP (namespace http://services.senior.com.br). Valores de encryption: 0 = credenciais em texto aberto (UTF-8), 1 = senha cifrada com algoritmo Senior (uso interno), 2 = token Senior, 3 = token de serviço cloud/Senior X. Execução Síncrona processa no WildFly e devolve o envelope com erroExecucao; Assíncrona e Agendada NÃO retornam o resultado do processamento ao solicitante (apenas 'OK' de enfileiramento). Requisito de infraestrutura: Middleware Senior instalado e g5-senior-services publicado.

*Fonte: https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/webservices/tipos_execucao/tipos_execucao.htm*

**Aplicação no HCB:** Para escala com validação linha a linha, usar SEMPRE o modo síncrono: cada chamada médico-dia devolve seu próprio erroExecucao, que viramos relatório de aceite (ex.: 'matrícula 1234, 15/11: horário 999 inexistente'). Async/Scheduled são inúteis para nós porque engolem o erro. Se a TI oferecer token da plataforma Senior X, usar encryption=3 substituindo password pelo token (documentado em https://documentacao.senior.com.br/tecnologia-senior-x/manual-do-usuario/integracoes/web-services.htm).

### A tela Programações Coletivas NÃO importa arquivo — o plano B manual continua sendo digitação

A doc da tela (Gestão de Pessoas > Colaboradores > Programações (CP) > Coletivas) descreve as abas (Horário, Escala, Pontes, Compensações, Horas Extras, Convocação etc.) e a abrangência via botão Filtro com marcação/desmarcação de colaboradores — mas não existe importação de CSV/planilha nessa tela no G5. Importação por arquivo CSV com validação e relatório de erros existe apenas no mundo Senior X (Gestão do Ponto X / Integrador HCM), que é outra plataforma: https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/hcm/importacao-e-exportacao/.

*Fonte: https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/ronda/frprgcol.htm*

**Aplicação no HCB:** Derruba a hipótese 'gerar um arquivo no layout da tela': esse layout não existe no G5. Ou automatizamos via WS, ou o RH segue digitando os códigos da nossa planilha na tela. Consequência de produto: o export CSV que geramos hoje deve permanecer como formato de CONFERÊNCIA humana, e a automação de verdade é o cliente SOAP.

### HCB/ICIPE roda Senior HCM G5 — confirmado por vaga interna; versão exata só com a TI

Vaga de Analista de Sistemas do próprio HCB exige, como obrigatório, 'Experiência em Cadastramento, Parametrização e Suporte do Sistema Senior' e 'customização de relatórios e regras utilizando LSP – Linguagem Senior de Programação'; como desejável, módulos 'HCM (Administração Pessoal, Controle de Ponto, Benefícios, Cargos e Salários, R&S, SESMT, Senior X - Painel de Gestão, Ferramentas de Apoio - Gerenciador de usuários (SGU e eDocs))'. LSP + SGU + Controle de Ponto = stack G5 on-premise clássica (o Ponto é o antigo Ronda, exatamente o módulo dono do programacaoColetiva). Senior X aparece só como painel. A versão numérica (6.2.x a 6.10.x) não é pública; a doc do WS está publicada na linha 6.10.x e a URL equivalente em 6.2.34 retorna 404, então não dá para garantir presença/formato idêntico em versões antigas sem confirmar.

*Fonte: https://www.hcb.org.br/arquivos/downloads/edital_de_de_abertura.pdf (vaga espelhada em https://www.hcb.org.br/trabalhe-conosco/450)*

**Aplicação no HCB:** Valida que o alvo é o G5 on-premise (WSDL SOAP), não o senior X/Integrador. Primeira pergunta à TI do ICIPE: qual versão do HCM e se o Middleware + g5-senior-services estão publicados. Bônus: existe analista interno que domina LSP/SGU — é o interlocutor técnico natural para liberar o usuário de integração.

### O que a TI precisa liberar: middleware no ar, URL do Java EE, usuário SGU com permissão, rede

Checklist oficial da Senior para integração via web services: serviços Glassfish/WildFly e Middleware em execução no servidor; no SeniorConfigCenter (como administrador), conferir 'Middleware / Web services' onde consta a 'URL do servidor Java EE'; testar o WSDL direto no navegador; exceções de proxy para o endereço do gerenciador do Middleware e a URL Java EE; sincronização de data/hora entre servidores; redeploy dos webservices quando necessário. Sobre credenciais: o erro 'Usuário não possui permissão para integração do WebService' se resolve no SGU — 'Na aba grupos, Adicione um grupo com permissão de Admin ao usuário', seguido de reinício do Middleware. Relato de integrador terceiro no fórum oficial mostra que a fricção real é configuração do middleware (chaves com.senior.g7.identityServerURL, trustedTenant, validatecertificate no ConfigCenter), não o WSDL em si: https://dev.senior.com.br/forums/topico/integracao-com-g5-webservice-customizado/.

*Fonte: https://suporte.senior.com.br/hc/pt-br/articles/4409364838292 e https://suporte.senior.com.br/hc/pt-br/articles/9617128936212*

**Aplicação no HCB:** Vira o pedido formal à TI do ICIPE em 3 itens: (1) URL do g5-senior-services acessível da rede onde rodará o script (provável exigência de VPN/rede interna — endpoint é on-premise), (2) usuário de integração no SGU com grupo de permissões que cubra o módulo CP/Ronda (a doc oficial manda Admin; negociar grupo dedicado só-integração por segurança), (3) confirmação da versão do HCM para validar o WSDL. Sem esses 3, nenhum export automático funciona.

**Recomendações desta lente:**

- Enviar à TI do ICIPE/HCB um pedido de 3 linhas: versão do Senior HCM em produção; URL do g5-senior-services (com teste de ?wsdl no navegador para ronda_Synccom_senior_g5_rh_hr_programacaoColetiva); usuário de integração no SGU com permissões do módulo Controle de Ponto (encryption=0 ou token). Sem isso, todo o resto é teoria.
- Antes de codar, fechar com o RH o De-Para: os 'códigos numéricos' que eles digitam hoje são códigos de HORÁRIO (cadastro do CP/Ronda, → operação Horario, campo novHor) ou códigos de ESCALA (→ historicos.Escala, campo codEsc)? Pedir a tabela de horários cadastrados (código ↔ turno/hora início-fim) — ela é o dicionário do payload.
- Prototipar o cliente SOAP no pipeline Python existente (zeep ou requests + template de envelope): modo síncrono, 1 chamada Horario por médico-dia com abrCad = matrícula e numEmp fixo, coletando erroExecucao por chamada num relatório de aceite (linha verde/vermelha por plantão). ~2.000 chamadas/mês é volume desprezível.
- Definir tipOpe como par de operações idempotentes: republicar a escala = E (excluir) da programação anterior + I (incluir) da nova no mesmo intervalo, para que trocas de última hora não dupliquem programação no Senior.
- Pilotar em novembro em paralelo: gerar a planilha como hoje (RH confere e digita se quiser) E disparar o WS em ambiente de homologação se a TI tiver um — só cortar a digitação manual depois de um mês com zero divergência entre erroExecucao e a folha apurada.
- Manter a tela Programações Coletivas como plano B documentado para o RH (caminho: Colaboradores > Programações (CP) > Coletivas, artigo https://suporte.senior.com.br/hc/pt-br/articles/18591500134676): é o mesmo motor do WS, útil para correções pontuais sem esperar o script.


## Lacunas apontadas pelo crítico

1. SENIOR — DO 'EXISTE' AO PAYLOAD: a Lente 2 provou que o canal existe (WS SOAP `programacaoColetiva` no G5/Vetorh, Integrador X no senior X), mas ninguém levantou a especificação concreta: quais campos/formatos exatos o WS e a tela Programações Coletivas aceitam (WSDL público? matrícula + data + código de horário basta? tratamento de erro por linha?), qual versão do Senior a OSS do HCB roda de fato, e o que a TI da OSS exige para liberar credenciais de integração. Sem isso, 'export no formato da casa' continua significando digitação manual do RH. Pesquisável: documentação/WSDL do web service Rubi/Vetorh `programacaoColetiva`, layout de importação da tela Programações Coletivas, e relatos de integração de terceiros com Senior G5 (fóruns TOTVS/Senior, consultores). *(coberta pelos complementos acima)*

2. COLETA EM NOVEMBRO SEM APP INSTALADO — MECÂNICA E ADOÇÃO: todas as lentes dizem 'formulário tipado com validação de cota na submissão', mas nenhuma respondeu COMO fazer isso com as ferramentas que os 66 médicos toparão usar em 4 semanas. Google Forms não valida contra estado vivo (cota já consumida, dias já lotados) — qual o padrão concreto: Apps Script interceptando onSubmit, planilha protegida com validação in-place, ou página no app com magic link Supabase sem cadastro? E o plano de migração e-mail→formulário: prazo de aviso, taxa de adesão esperada, o que fazer com quem não envia (ByteBloc 'cobra quem não enviou' — cobrando como?), e fallback documentado de algum caso real de transição. Pesquisável: padrões Form→Sheet→Apps Script com validação de cota em tempo real; casos de migração de coleta por e-mail para formulário em equipes médicas/enfermagem. *(coberta pelos complementos acima)*

3. INVIABILIDADE EXPLICADA — O MÊS QUE NÃO FECHA: já sabemos por aritmética que mês de 5 sábados não fecha (memória do projeto), e a Lente 3 só cobriu o caminho feliz do solver. Falta a mecânica do caminho triste: como o CP-SAT aponta o conjunto mínimo de restrições conflitantes (assumptions / sufficient_assumptions_for_infeasibility), como ordenar relaxamentos sugeridos ('libere a cota de fds de X ou convoque +1 pessoa no turno Y'), e qual o tempo real de solve para ~66 médicos × 30 dias × 3 turnos com nosso conjunto de regras (benchmarks de instâncias INRC-II de tamanho comparável). Sem isso o otimizador vira caixa-preta que 'não achou solução' — exatamente o que a escalista não pode receber. Pesquisável: docs de infeasibility explanation do CP-SAT, ScoreAnalysis do Timefold para escalas inviáveis, benchmarks de nurse rostering ~60-70 pessoas. *(coberta pelos complementos acima)*

4. PÓS-PUBLICAÇÃO — MANTER 3 FORMATOS + SENIOR CONSISTENTES COM TROCAS NO MEIO DO MÊS: a Lente 1 diz que folha é 'derivado da escala viva' e a Lente 4 normaliza a troca pós-publicação, mas ninguém descreveu a mecânica do ciclo de mudança no nosso caso: quando um médico troca dia 12, quem atualiza a planilha-fonte, com que cadência se republica grade/PDF/códigos, como se comunica o diff (v2 vs v1) sem reenviar tudo, e como o Senior trata lançamento retroativo/retificação depois do corte da folha (competência fechada, 'scheduled vs worked' à la ByteBloc). Pesquisável: como QGenda/Amion/Escala App versionam e notificam mudanças pós-publicação; regras de retificação de programação de horário no Senior HCM após fechamento de competência; prazo de corte de folha em OSS. *(coberta pelos complementos acima)*

5. AMARRAS LEGAIS BRASILEIRAS DO PROCESSO (NÃO DA JORNADA): o validador CLT cobre interjornada/DSR/noturno, mas nenhuma lente pesquisou o processo legal de publicação e alteração: existe antecedência mínima (legal, de CCT dos médicos, ou jurisprudencial) para divulgar a escala mensal e para alterar um plantão já publicado? Troca entre médicos CLT exige registro formal (acordo individual escrito, art. 59? anuência do empregador documentada?) para não virar passivo trabalhista da OSS? E preferência atendida com habitualidade cria direito adquirido a horário (o modo de falha 'entitlement' do MIT/Brigham tem análogo jurídico no Brasil)? Pesquisável: CCT do sindicato dos médicos do estado do HCB sobre escala/antecedência, jurisprudência TST sobre alteração unilateral de escala, exigências formais de compensação de jornada CLT. *(EM ABERTO — não pesquisada)*

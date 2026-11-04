/* ===== Chavez Barbearia — lógica do app ===== */

// ---------- TABELA DE PREÇOS ORIGINAL (cardápio) ----------
// Depois de instalado, os preços são alterados dentro do app, na aba "Preços".
const SERVICOS_PADRAO = [
  { id: 'corte',                   nome: 'Corte',                       preco: 15 },
  { id: 'corte-navalhado',         nome: 'Corte navalhado',             preco: 20 },
  { id: 'corte-tesoura',           nome: 'Corte na tesoura',            preco: 20 },
  { id: 'barba',                   nome: 'Barba',                       preco: 10 },
  { id: 'pezinho',                 nome: 'Pezinho',                     preco: 7 },
  { id: 'sobrancelha',             nome: 'Sobrancelha',                 preco: 7 },
  { id: 'corte-sobrancelha',       nome: 'Corte + sobrancelha',         preco: 20 },
  { id: 'corte-barba',             nome: 'Corte + barba',               preco: 25 },
  { id: 'corte-barba-sobrancelha', nome: 'Corte + barba + sobrancelha', preco: 30 },
  { id: 'luzes',                   nome: 'Luzes',                       preco: 80 },
  { id: 'nevou',                   nome: 'Nevou',                       preco: 90 },
  { id: 'pigmentacao',             nome: 'Pigmentação',                 preco: 30 },
];

const CHAVE_STORAGE = 'chavez-barbearia-v1';

// ---------- Utilidades ----------
const $ = (id) => document.getElementById(id);

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl = (v) => moeda.format(v);

function hoje() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function novoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// soma em centavos para evitar erros de ponto flutuante
function soma(lista) {
  const centavos = lista.reduce((acc, x) => acc + Math.round(x.valor * 100), 0);
  return centavos / 100;
}

function nomeDoMes(ym) {
  const [a, m] = ym.split('-').map(Number);
  const txt = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function dataCurta(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function plural(n, singular, pluralTxt) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

let toastTimer;
function aviso(texto) {
  const el = $('toast');
  el.textContent = texto;
  el.classList.add('visivel');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visivel'), 1800);
}

// ---------- Dados ----------
function copiaPadrao() {
  return SERVICOS_PADRAO.map((s) => ({ ...s }));
}

function dadosVazios() {
  return { cortes: [], despesas: [], servicos: copiaPadrao() };
}

function validar(obj) {
  if (!obj || !Array.isArray(obj.cortes) || !Array.isArray(obj.despesas)) return null;
  const dataOk = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const valorOk = (v) => typeof v === 'number' && isFinite(v) && v >= 0;

  // dados antigos (sem lista de serviços) ganham a tabela do cardápio
  const servicos = Array.isArray(obj.servicos)
    ? obj.servicos
        .filter((s) => s && typeof s.nome === 'string' && s.nome.trim() && typeof s.preco === 'number' && isFinite(s.preco) && s.preco > 0)
        .map((s) => ({ id: String(s.id || novoId()), nome: s.nome.trim(), preco: s.preco }))
    : copiaPadrao();

  return {
    cortes: obj.cortes
      .filter((c) => dataOk(c.data) && valorOk(c.valor) && typeof c.servico === 'string')
      .map((c) => ({ id: String(c.id || novoId()), data: c.data, servico: c.servico, valor: c.valor })),
    despesas: obj.despesas
      .filter((d) => dataOk(d.data) && valorOk(d.valor) && typeof d.descricao === 'string')
      .map((d) => ({ id: String(d.id || novoId()), data: d.data, descricao: d.descricao, valor: d.valor })),
    servicos,
  };
}

function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE);
    if (!bruto) return dadosVazios();
    return validar(JSON.parse(bruto)) || dadosVazios();
  } catch (e) {
    return dadosVazios();
  }
}

function salvar() {
  try {
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
    return true;
  } catch (e) {
    aviso('Não foi possível salvar neste aparelho');
    return false;
  }
}

let dados = carregar();
let mesAtual = hoje().slice(0, 7);

// ---------- Renderização ----------
function criaItem(titulo, subtitulo, valor, corValor, aoApagar) {
  const li = document.createElement('li');

  const info = document.createElement('div');
  info.className = 'info';
  const t = document.createElement('strong');
  t.textContent = titulo;
  const s = document.createElement('small');
  s.textContent = subtitulo;
  info.append(t, s);

  const dir = document.createElement('div');
  dir.className = 'dir';
  const v = document.createElement('span');
  v.className = corValor;
  v.textContent = brl(valor);
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-apagar';
  b.setAttribute('aria-label', 'Apagar');
  b.textContent = '✕';
  b.addEventListener('click', aoApagar);
  dir.append(v, b);

  li.append(info, dir);
  return li;
}

function ordenar(lista) {
  return [...lista].sort((a, b) => (a.data === b.data ? (a.id < b.id ? 1 : -1) : a.data < b.data ? 1 : -1));
}

// Botões da página Cortes + lista editável da página Preços
function renderServicos() {
  // botões de registrar atendimento
  const caixa = $('botoes-servicos');
  caixa.replaceChildren(
    ...dados.servicos.map((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn-servico';
      const n = document.createElement('span');
      n.className = 'nome';
      n.textContent = p.nome;
      const v = document.createElement('span');
      v.className = 'preco';
      v.textContent = brl(p.preco);
      b.append(n, v);
      b.addEventListener('click', () => registrarCorte(p));
      return b;
    })
  );

  // lista de preços editáveis
  const lista = $('lista-precos');
  lista.replaceChildren(
    ...dados.servicos.map((p) => {
      const li = document.createElement('li');

      const info = document.createElement('div');
      info.className = 'info';
      const nome = document.createElement('strong');
      nome.textContent = p.nome;
      info.append(nome);

      const dir = document.createElement('div');
      dir.className = 'dir';
      const rs = document.createElement('span');
      rs.className = 'suave';
      rs.textContent = 'R$';
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'input-preco';
      inp.step = '0.01';
      inp.min = '0.01';
      inp.setAttribute('inputmode', 'decimal');
      inp.setAttribute('aria-label', `Preço de ${p.nome}`);
      inp.value = String(p.preco);
      inp.addEventListener('change', () => alterarPreco(p.id, inp.value));
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn-apagar';
      b.setAttribute('aria-label', `Remover ${p.nome}`);
      b.textContent = '✕';
      b.addEventListener('click', () => removerServico(p.id));
      dir.append(rs, inp, b);

      li.append(info, dir);
      return li;
    })
  );
  $('vazio-precos').hidden = dados.servicos.length > 0;
}

function render() {
  $('mes-label').textContent = nomeDoMes(mesAtual);

  const cortes = ordenar(dados.cortes.filter((c) => c.data.startsWith(mesAtual)));
  const despesas = ordenar(dados.despesas.filter((d) => d.data.startsWith(mesAtual)));

  const totalCortes = soma(cortes);
  const totalDesp = soma(despesas);
  const lucro = Math.round((totalCortes - totalDesp) * 100) / 100;

  // Resumo
  const elLucro = $('res-lucro');
  elLucro.textContent = brl(lucro);
  elLucro.style.color = lucro < 0 ? 'var(--vermelho)' : 'var(--texto)';
  $('res-bruto').textContent = brl(totalCortes);
  $('res-qtd').textContent = plural(cortes.length, 'atendimento', 'atendimentos');
  $('res-despesas').textContent = brl(totalDesp);
  $('res-qtd-desp').textContent = plural(despesas.length, 'lançamento', 'lançamentos');

  // Por serviço (só os que tiveram atendimento no mês)
  const grupos = new Map();
  cortes.forEach((c) => {
    if (!grupos.has(c.servico)) grupos.set(c.servico, []);
    grupos.get(c.servico).push(c);
  });
  const ordem = dados.servicos.map((s) => s.nome);
  const posicao = (nome) => {
    const i = ordem.indexOf(nome);
    return i === -1 ? ordem.length : i;
  };
  const nomes = [...grupos.keys()].sort((a, b) => posicao(a) - posicao(b));

  const ul = $('res-servicos');
  if (nomes.length === 0) {
    const li = document.createElement('li');
    li.className = 'vazio-linha';
    li.textContent = 'Nenhum atendimento neste mês.';
    ul.replaceChildren(li);
  } else {
    ul.replaceChildren(
      ...nomes.map((nome) => {
        const itens = grupos.get(nome);
        const li = document.createElement('li');
        const esq = document.createElement('span');
        esq.textContent = nome + ' ';
        const q = document.createElement('span');
        q.className = 'qtd';
        q.textContent = `× ${itens.length}`;
        esq.append(q);
        const dir = document.createElement('strong');
        dir.textContent = brl(soma(itens));
        li.append(esq, dir);
        return li;
      })
    );
  }

  // Página de cortes
  $('cortes-total').textContent = brl(totalCortes);
  $('cortes-qtd').textContent = plural(cortes.length, 'atendimento', 'atendimentos');
  $('lista-cortes').replaceChildren(
    ...cortes.map((c) => criaItem(c.servico, dataCurta(c.data), c.valor, 'positivo', () => apagarCorte(c.id)))
  );
  $('vazio-cortes').hidden = cortes.length > 0;

  // Página de despesas
  $('desp-total').textContent = brl(totalDesp);
  $('desp-qtd').textContent = plural(despesas.length, 'lançamento', 'lançamentos');
  $('lista-despesas').replaceChildren(
    ...despesas.map((d) => criaItem(d.descricao, dataCurta(d.data), d.valor, 'negativo', () => apagarDespesa(d.id)))
  );
  $('vazio-despesas').hidden = despesas.length > 0;
}

// ---------- Ações ----------
function mudarMes(delta) {
  const [a, m] = mesAtual.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  mesAtual = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  render();
}

function irParaMesDe(dataIso) {
  mesAtual = dataIso.slice(0, 7);
}

function registrarCorte(servico) {
  const data = $('corte-data').value || hoje();
  dados.cortes.push({ id: novoId(), data, servico: servico.nome, valor: servico.preco });
  if (!salvar()) { dados.cortes.pop(); return; }
  irParaMesDe(data);
  render();
  aviso(`${servico.nome} · ${brl(servico.preco)} registrado`);
}

function apagarCorte(id) {
  const c = dados.cortes.find((x) => x.id === id);
  if (!c) return;
  if (!confirm(`Apagar "${c.servico}" de ${dataCurta(c.data)}?`)) return;
  dados.cortes = dados.cortes.filter((x) => x.id !== id);
  salvar();
  render();
}

function apagarDespesa(id) {
  const d = dados.despesas.find((x) => x.id === id);
  if (!d) return;
  if (!confirm(`Apagar a despesa "${d.descricao}"?`)) return;
  dados.despesas = dados.despesas.filter((x) => x.id !== id);
  salvar();
  render();
}

function adicionarDespesa(ev) {
  ev.preventDefault();
  const descricao = $('desp-descricao').value.trim();
  const valor = Math.round(parseFloat($('desp-valor').value) * 100) / 100;
  const data = $('desp-data').value || hoje();
  if (!descricao || !isFinite(valor) || valor <= 0) {
    aviso('Preencha descrição e valor');
    return;
  }
  dados.despesas.push({ id: novoId(), data, descricao, valor });
  if (!salvar()) { dados.despesas.pop(); return; }
  irParaMesDe(data);
  ev.target.reset();
  $('desp-data').value = hoje();
  render();
  aviso('Despesa adicionada');
}

// ----- Preços e serviços -----
function alterarPreco(id, texto) {
  const servico = dados.servicos.find((s) => s.id === id);
  if (!servico) return;
  const novo = Math.round(parseFloat(texto) * 100) / 100;
  if (!isFinite(novo) || novo <= 0) {
    aviso('Preço inválido');
    renderServicos();
    return;
  }
  servico.preco = novo;
  salvar();
  renderServicos();
  aviso(`${servico.nome}: ${brl(novo)}`);
}

function removerServico(id) {
  const servico = dados.servicos.find((s) => s.id === id);
  if (!servico) return;
  if (!confirm(`Remover "${servico.nome}" da tabela?\n\nOs atendimentos já registrados continuam salvos.`)) return;
  dados.servicos = dados.servicos.filter((s) => s.id !== id);
  salvar();
  renderServicos();
  render();
  aviso('Serviço removido');
}

function adicionarServico(ev) {
  ev.preventDefault();
  const nome = $('serv-nome').value.trim();
  const preco = Math.round(parseFloat($('serv-preco').value) * 100) / 100;
  if (!nome || !isFinite(preco) || preco <= 0) {
    aviso('Preencha nome e preço');
    return;
  }
  if (dados.servicos.some((s) => s.nome.toLowerCase() === nome.toLowerCase())) {
    aviso('Esse serviço já existe');
    return;
  }
  dados.servicos.push({ id: novoId(), nome, preco });
  salvar();
  ev.target.reset();
  renderServicos();
  render();
  aviso(`${nome} adicionado`);
}

function restaurarPrecos() {
  if (!confirm('Voltar para a tabela original do cardápio?\n\nSeus atendimentos e despesas não serão apagados.')) return;
  dados.servicos = copiaPadrao();
  salvar();
  renderServicos();
  render();
  aviso('Tabela original restaurada');
}

// ---------- Backup ----------
function exportar() {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chavez-barbearia-backup-${hoje()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  aviso('Backup baixado');
}

function importar(arquivo) {
  if (!arquivo) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    try {
      const novo = validar(JSON.parse(leitor.result));
      if (!novo) throw new Error('formato');
      const msg = `Restaurar backup com ${novo.cortes.length} atendimentos e ${novo.despesas.length} despesas?\n\nIsso substitui os dados atuais deste aparelho.`;
      if (!confirm(msg)) return;
      dados = novo;
      salvar();
      renderServicos();
      render();
      aviso('Backup restaurado');
    } catch (e) {
      aviso('Arquivo de backup inválido');
    }
  };
  leitor.readAsText(arquivo);
}

// ---------- Inicialização ----------
function iniciar() {
  // datas padrão
  $('corte-data').value = hoje();
  $('desp-data').value = hoje();

  // abas
  document.querySelectorAll('.aba').forEach((aba) => {
    aba.addEventListener('click', () => {
      document.querySelectorAll('.aba').forEach((x) => x.classList.toggle('ativa', x === aba));
      document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('ativa', t.id === `tela-${aba.dataset.tela}`));
      window.scrollTo({ top: 0 });
    });
  });

  // mês
  $('mes-anterior').addEventListener('click', () => mudarMes(-1));
  $('mes-proximo').addEventListener('click', () => mudarMes(1));

  // formulários e botões
  $('form-despesa').addEventListener('submit', adicionarDespesa);
  $('form-servico').addEventListener('submit', adicionarServico);
  $('btn-restaurar-precos').addEventListener('click', restaurarPrecos);
  $('btn-exportar').addEventListener('click', exportar);
  $('btn-importar').addEventListener('click', () => $('arquivo-importar').click());
  $('arquivo-importar').addEventListener('change', (e) => {
    importar(e.target.files[0]);
    e.target.value = '';
  });

  renderServicos();
  render();

  // pede ao navegador para não apagar os dados salvos
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  // modo instalável / offline
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

iniciar();
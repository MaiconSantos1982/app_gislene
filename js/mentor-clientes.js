// ID FIXO DO MENTOR
const MENTOR_ID_FIXO = '85de5f16-1f9e-4d0d-82c0-a2e639baae86'; // SEU ID

let usuarioLogado = null;
let clienteAtual = null;

console.log('mentor-clientes.js carregado');

// Verificar autenticação
async function verificarAutenticacao() {
    // Verificar se tem acesso direto (sem autenticação)
    const acessoDireto = localStorage.getItem('mentor_acesso_direto');
    
    if (acessoDireto === 'true') {
        // Buscar mentor pelo ID fixo
        const { data: mentor, error } = await supabase
            .from('appgi_mentoria_usuarios')
            .select('*')
            .eq('id', MENTOR_ID_FIXO)
            .single();
        
        if (mentor) {
            usuarioLogado = mentor;
            console.log('Mentor carregado:', usuarioLogado);
            carregarClientes();
        } else {
            alert('Mentor não encontrado. Verifique o ID fixo no código.');
            window.location.href = 'index.html';
        }
        return;
    }
    
    // Fluxo normal de autenticação
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    
    const { data: usuario, error } = await supabase
        .from('appgi_mentoria_usuarios')
        .select('*')
        .eq('auth_id', session.user.id)
        .single();
    
    if (error || !usuario || usuario.tipo !== 'mentor') {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
        return;
    }
    
    usuarioLogado = usuario;
    carregarClientes();
}

// Carregar lista de clientes
async function carregarClientes() {
    try {
        const { data: clientes, error } = await supabase
            .from('appgi_mentoria_clientes')
            .select(`
                id,
                nicho_atuacao,
                empresa,
                created_at,
                usuario:usuario_id (
                    id,
                    nome,
                    email,
                    telefone,
                    ativo
                ),
                processo:appgi_mentoria_processos (
                    status
                )
            `)
            .eq('mentor_id', usuarioLogado.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('tabelaClientes');
        
        if (clientes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                        Nenhum cliente cadastrado ainda
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = clientes.map(cliente => {
            const statusProcesso = cliente.processo?.[0]?.status || 'sem_processo';
            const statusBadge = {
                'ativo': '<span class="badge bg-success">Ativo</span>',
                'concluido': '<span class="badge bg-secondary">Concluído</span>',
                'pausado': '<span class="badge bg-warning">Pausado</span>',
                'sem_processo': '<span class="badge bg-light text-dark">Sem Processo</span>'
            };
            
            return `
                <tr>
                    <td>${cliente.usuario.nome}</td>
                    <td>${cliente.usuario.email}</td>
                    <td>${cliente.usuario.telefone || '-'}</td>
                    <td>${cliente.empresa || '-'}</td>
                    <td>${cliente.nicho_atuacao || '-'}</td>
                    <td>${statusBadge[statusProcesso]}</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary" onclick="verDetalhesCliente('${cliente.id}')">
                            <i class="bi bi-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        document.getElementById('tabelaClientes').innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger">
                    Erro ao carregar clientes
                </td>
            </tr>
        `;
    }
}

// Salvar novo cliente - EVENT LISTENER
document.addEventListener('DOMContentLoaded', () => {
    const btnSalvar = document.getElementById('btnSalvarCliente');
    console.log('Botão encontrado:', btnSalvar);
    
    if (btnSalvar) {
        btnSalvar.addEventListener('click', salvarNovoCliente);
    }
});

// Função para salvar novo cliente
async function salvarNovoCliente() {
    console.log('Função salvarNovoCliente chamada');
    
    const form = document.getElementById('formNovoCliente');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    if (!usuarioLogado || !usuarioLogado.id) {
        alert('Erro: Mentor não identificado. Recarregue a página.');
        return;
    }
    
    const dados = {
        nome: document.getElementById('nomeCliente').value.trim(),
        email: document.getElementById('emailCliente').value.trim(),
        telefone: document.getElementById('telefoneCliente').value.trim(),
        empresa: document.getElementById('empresaCliente').value.trim(),
        nicho: document.getElementById('nichoCliente').value.trim(),
        porqueProcesso: document.getElementById('porqueProcesso').value.trim(),
        objetivos: document.getElementById('objetivos').value.trim(),
        observacoesGerais: document.getElementById('observacoesGerais').value.trim(),
        duracaoSemanas: parseInt(document.getElementById('duracaoSemanas').value),
        dataInicio: document.getElementById('dataInicio').value
    };
    
    console.log('Dados do cliente:', dados);
    
    const btnSalvar = document.getElementById('btnSalvarCliente');
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Salvando...';
    
    try {
        // 1. Criar usuário
        console.log('Criando usuário...');
        const { data: usuario, error: usuarioError } = await supabase
            .from('appgi_mentoria_usuarios')
            .insert({
                nome: dados.nome,
                email: dados.email,
                telefone: dados.telefone,
                tipo: 'cliente',
                mentor_id: usuarioLogado.id
            })
            .select()
            .single();
        
        if (usuarioError) throw usuarioError;
        console.log('Usuário criado:', usuario);
        
        // 2. Criar cliente
        console.log('Criando cliente...');
        const { data: cliente, error: clienteError } = await supabase
            .from('appgi_mentoria_clientes')
            .insert({
                usuario_id: usuario.id,
                mentor_id: usuarioLogado.id,
                nicho_atuacao: dados.nicho,
                empresa: dados.empresa
            })
            .select()
            .single();
        
        if (clienteError) throw clienteError;
        console.log('Cliente criado:', cliente);
        
        // 3. Criar processo
        console.log('Criando processo...');
        const { data: processo, error: processoError } = await supabase
            .from('appgi_mentoria_processos')
            .insert({
                cliente_id: cliente.id,
                mentor_id: usuarioLogado.id,
                porque_processo: dados.porqueProcesso,
                objetivos: dados.objetivos,
                observacoes_gerais: dados.observacoesGerais,
                duracao_semanas: dados.duracaoSemanas,
                data_inicio: dados.dataInicio,
                status: 'ativo'
            })
            .select()
            .single();
        
        if (processoError) throw processoError;
        console.log('Processo criado:', processo);
        
        // 4. Criar tarefas
        console.log('Criando tarefas...');
        const tarefas = [];
        const dataInicio = new Date(dados.dataInicio);
        
        for (let semana = 1; semana <= dados.duracaoSemanas; semana++) {
            const dataInicioSemana = new Date(dataInicio);
            dataInicioSemana.setDate(dataInicio.getDate() + ((semana - 1) * 7));
            
            const dataPrazoSemana = new Date(dataInicioSemana);
            dataPrazoSemana.setDate(dataInicioSemana.getDate() + 6);
            
            tarefas.push({
                processo_id: processo.id,
                mentor_id: usuarioLogado.id,
                cliente_id: cliente.id,
                semana: semana,
                titulo: `Semana ${semana}`,
                descricao: '',
                data_inicio: dataInicioSemana.toISOString().split('T')[0],
                data_prazo: dataPrazoSemana.toISOString().split('T')[0],
                status: 'a_iniciar'
            });
        }
        
        const { error: tarefasError } = await supabase
            .from('appgi_mentoria_tarefas')
            .insert(tarefas);
        
        if (tarefasError) throw tarefasError;
        console.log('Tarefas criadas!');
        
        // Sucesso
        alert('Cliente cadastrado com sucesso! O cliente pode criar sua senha no primeiro acesso.');
        
        // Fechar modal
        const modalElement = document.getElementById('modalNovoCliente');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) {
            modalInstance.hide();
        }
        form.reset();
        
        // Recarregar lista
        carregarClientes();
        
    } catch (error) {
        console.error('Erro ao cadastrar cliente:', error);
        alert(`Erro ao cadastrar cliente: ${error.message}`);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = 'Salvar e Criar Tarefas';
    }
}

// Ver detalhes do cliente
async function verDetalhesCliente(clienteId) {
    try {
        const { data: cliente, error } = await supabase
            .from('appgi_mentoria_clientes')
            .select(`
                id,
                nicho_atuacao,
                empresa,
                usuario:usuario_id (
                    nome,
                    email,
                    telefone
                ),
                processo:appgi_mentoria_processos (
                    id,
                    porque_processo,
                    objetivos,
                    observacoes_gerais,
                    duracao_semanas,
                    data_inicio,
                    status
                )
            `)
            .eq('id', clienteId)
            .single();
        
        if (error) throw error;
        
        const { data: tarefas, error: tarefasError } = await supabase
            .from('appgi_mentoria_tarefas')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('semana', { ascending: true });
        
        if (tarefasError) throw tarefasError;
        
        const conteudo = `
            <div class="row">
                <div class="col-md-6 mb-4">
                    <div class="card border-0 bg-light h-100">
                        <div class="card-body">
                            <h6 class="fw-bold mb-3">Dados do Cliente</h6>
                            <p class="mb-2"><strong>Nome:</strong> ${cliente.usuario.nome}</p>
                            <p class="mb-2"><strong>E-mail:</strong> ${cliente.usuario.email}</p>
                            <p class="mb-2"><strong>Telefone:</strong> ${cliente.usuario.telefone || '-'}</p>
                            <p class="mb-2"><strong>Empresa:</strong> ${cliente.empresa || '-'}</p>
                            <p class="mb-0"><strong>Nicho:</strong> ${cliente.nicho_atuacao || '-'}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 mb-4">
                    <div class="card border-0 bg-light h-100">
                        <div class="card-body">
                            <h6 class="fw-bold mb-3">Processo de Mentoria</h6>
                            <p class="mb-2"><strong>Duração:</strong> ${cliente.processo[0].duracao_semanas} semanas</p>
                            <p class="mb-2"><strong>Início:</strong> ${formatarData(cliente.processo[0].data_inicio)}</p>
                            <p class="mb-2"><strong>Status:</strong> ${cliente.processo[0].status}</p>
                            <p class="mb-2"><strong>Por quê:</strong> ${cliente.processo[0].porque_processo}</p>
                            <p class="mb-0"><strong>Objetivos:</strong> ${cliente.processo[0].objetivos}</p>
                        </div>
                    </div>
                </div>
                <div class="col-12">
                    <h6 class="fw-bold mb-3">Tarefas</h6>
                    <div class="accordion" id="accordionTarefas">
                        ${tarefas.map((tarefa, index) => `
                            <div class="accordion-item">
                                <h2 class="accordion-header">
                                    <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" 
                                        data-bs-toggle="collapse" data-bs-target="#tarefa${tarefa.id}">
                                        Semana ${tarefa.semana} - ${tarefa.titulo}
                                        <span class="ms-2">${getBadgeStatus(tarefa.status, tarefa.data_prazo)}</span>
                                    </button>
                                </h2>
                                <div id="tarefa${tarefa.id}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" 
                                    data-bs-parent="#accordionTarefas">
                                    <div class="accordion-body">
                                        <form onsubmit="salvarTarefa(event, '${tarefa.id}')">
                                            <div class="mb-3">
                                                <label class="form-label">Título da Tarefa</label>
                                                <input type="text" class="form-control" value="${tarefa.titulo}" 
                                                    id="titulo_${tarefa.id}" required>
                                            </div>
                                            <div class="mb-3">
                                                <label class="form-label">Descrição</label>
                                                <textarea class="form-control" rows="3" 
                                                    id="descricao_${tarefa.id}">${tarefa.descricao || ''}</textarea>
                                            </div>
                                            <div class="row mb-3">
                                                <div class="col-md-6">
                                                    <label class="form-label">Data Início</label>
                                                    <input type="date" class="form-control" value="${tarefa.data_inicio}" 
                                                        id="data_inicio_${tarefa.id}" required>
                                                </div>
                                                <div class="col-md-6">
                                                    <label class="form-label">Data Prazo</label>
                                                    <input type="date" class="form-control" value="${tarefa.data_prazo}" 
                                                        id="data_prazo_${tarefa.id}" required>
                                                </div>
                                            </div>
                                            <div class="mb-3">
                                                <label class="form-label">Observações do Mentor</label>
                                                <textarea class="form-control" rows="2" 
                                                    id="obs_mentor_${tarefa.id}">${tarefa.observacoes_mentor || ''}</textarea>
                                            </div>
                                            <div class="mb-3">
                                                <label class="form-label">Observações do Cliente</label>
                                                <textarea class="form-control" rows="2" readonly 
                                                    id="obs_cliente_${tarefa.id}">${tarefa.observacoes_cliente || '-'}</textarea>
                                            </div>
                                            <div class="mb-3">
                                                <label class="form-label">Status</label>
                                                <select class="form-select" id="status_${tarefa.id}">
                                                    <option value="a_iniciar" ${tarefa.status === 'a_iniciar' ? 'selected' : ''}>A Iniciar</option>
                                                    <option value="em_andamento" ${tarefa.status === 'em_andamento' ? 'selected' : ''}>Em Andamento</option>
                                                    <option value="concluido" ${tarefa.status === 'concluido' ? 'selected' : ''}>Concluído</option>
                                                </select>
                                            </div>
                                            <button type="submit" class="btn btn-primary">Salvar Alterações</button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('conteudoDetalhesCliente').innerHTML = conteudo;
        new bootstrap.Modal(document.getElementById('modalDetalhesCliente')).show();
        
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        alert('Erro ao carregar detalhes do cliente');
    }
}

// Salvar tarefa
async function salvarTarefa(event, tarefaId) {
    event.preventDefault();
    
    const dados = {
        titulo: document.getElementById(`titulo_${tarefaId}`).value,
        descricao: document.getElementById(`descricao_${tarefaId}`).value,
        data_inicio: document.getElementById(`data_inicio_${tarefaId}`).value,
        data_prazo: document.getElementById(`data_prazo_${tarefaId}`).value,
        observacoes_mentor: document.getElementById(`obs_mentor_${tarefaId}`).value,
        status: document.getElementById(`status_${tarefaId}`).value
    };
    
    try {
        const { error } = await supabase
            .from('appgi_mentoria_tarefas')
            .update(dados)
            .eq('id', tarefaId);
        
        if (error) throw error;
        alert('Tarefa atualizada com sucesso!');
        
    } catch (error) {
        console.error('Erro ao salvar tarefa:', error);
        alert('Erro ao salvar tarefa');
    }
}

// Helpers
function getBadgeStatus(status, dataPrazo) {
    const hoje = new Date().toISOString().split('T')[0];
    
    if (status === 'concluido') {
        return '<span class="badge bg-success ms-2">Concluído</span>';
    } else if (dataPrazo < hoje) {
        return '<span class="badge bg-danger ms-2">Atrasada</span>';
    } else if (status === 'em_andamento') {
        return '<span class="badge bg-primary ms-2">Em Andamento</span>';
    } else {
        return '<span class="badge bg-secondary ms-2">A Iniciar</span>';
    }
}

function formatarData(dataString) {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Logout
document.getElementById('btnLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    localStorage.removeItem('mentor_acesso_direto');
    await supabase.auth.signOut();
    window.location.href = 'index.html';
});

// Inicializar
verificarAutenticacao();

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
        // Buscar clientes
        const { data: clientes, error: clientesError } = await supabase
            .from('appgi_mentoria_clientes')
            .select('id, nicho_atuacao, empresa, created_at, usuario_id')
            .eq('mentor_id', usuarioLogado.id)
            .order('created_at', { ascending: false });
        
        if (clientesError) throw clientesError;
        
        // Buscar usuários
        const usuarioIds = clientes.map(c => c.usuario_id);
        const { data: usuarios, error: usuariosError } = await supabase
            .from('appgi_mentoria_usuarios')
            .select('id, nome, email, telefone, ativo')
            .in('id', usuarioIds);
        
        if (usuariosError) throw usuariosError;
        
        // Buscar processos
        const clienteIds = clientes.map(c => c.id);
        const { data: processos, error: processosError } = await supabase
            .from('appgi_mentoria_processos')
            .select('cliente_id, status')
            .in('cliente_id', clienteIds);
        
        if (processosError) throw processosError;
        
        console.log('Clientes:', clientes);
        console.log('Usuários:', usuarios);
        console.log('Processos:', processos);
        
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
            // Encontrar usuário
            const usuario = usuarios.find(u => u.id === cliente.usuario_id);
            
            // Encontrar processo
            const processo = processos?.find(p => p.cliente_id === cliente.id);
            const statusProcesso = processo?.status || 'sem_processo';
            
            const statusBadge = {
                'ativo': '<span class="badge bg-success">Ativo</span>',
                'concluido': '<span class="badge bg-secondary">Concluído</span>',
                'pausado': '<span class="badge bg-warning">Pausado</span>',
                'sem_processo': '<span class="badge bg-light text-dark">Sem Processo</span>'
            };
            
            return `
                <tr>
                    <td>${usuario?.nome || '-'}</td>
                    <td>${usuario?.email || '-'}</td>
                    <td>${usuario?.telefone || '-'}</td>
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
        telefone: removerMascaraTelefone(document.getElementById('telefoneCliente').value.trim()),
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
        // Buscar cliente
        const { data: cliente, error: clienteError } = await supabase
            .from('appgi_mentoria_clientes')
            .select(`
                id,
                nicho_atuacao,
                empresa,
                usuario:usuario_id (
                    id,
                    nome,
                    email,
                    telefone
                )
            `)
            .eq('id', clienteId)
            .single();
        
        if (clienteError) throw clienteError;
        
        console.log('Cliente:', cliente);
        
        // Buscar processo separadamente
        const { data: processos, error: processoError } = await supabase
            .from('appgi_mentoria_processos')
            .select('*')
            .eq('cliente_id', clienteId);
        
        if (processoError) throw processoError;
        
        console.log('Processos:', processos);
        
        // Verificar se o processo existe
        if (!processos || processos.length === 0) {
            alert('Este cliente ainda não possui um processo de mentoria cadastrado.');
            return;
        }
        
        const processo = processos[0];
        
        // Salvar dados globais ANTES de abrir modal
        clienteAtual = {
            id: clienteId,
            nicho_atuacao: cliente.nicho_atuacao,
            empresa: cliente.empresa,
            usuario: cliente.usuario
        };
        
        processoAtual = processo;
        
        // Buscar tarefas
        const { data: tarefas, error: tarefasError } = await supabase
            .from('appgi_mentoria_tarefas')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('semana', { ascending: true });
        
        if (tarefasError) throw tarefasError;
        
        console.log('Tarefas:', tarefas);
        
        const conteudo = `
            <div class="row">
                <div class="col-md-6 mb-4">
                    <div class="card border-0 bg-light h-100">
                        <div class="card-body">
                            <h6 class="fw-bold mb-3">Dados do Cliente</h6>
                            <p class="mb-2"><strong>Nome:</strong> ${cliente.usuario?.nome || '-'}</p>
                            <p class="mb-2"><strong>E-mail:</strong> ${cliente.usuario?.email || '-'}</p>
                            <p class="mb-2"><strong>Telefone:</strong> ${cliente.usuario?.telefone || '-'}</p>
                            <p class="mb-2"><strong>Empresa:</strong> ${cliente.empresa || '-'}</p>
                            <p class="mb-0"><strong>Nicho:</strong> ${cliente.nicho_atuacao || '-'}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 mb-4">
                    <div class="card border-0 bg-light h-100">
                        <div class="card-body">
                            <h6 class="fw-bold mb-3">Processo de Mentoria</h6>
                            <p class="mb-2"><strong>Duração:</strong> ${processo.duracao_semanas} semanas</p>
                            <p class="mb-2"><strong>Início:</strong> ${formatarData(processo.data_inicio)}</p>
                            <p class="mb-2"><strong>Status:</strong> ${processo.status}</p>
                            <p class="mb-2"><strong>Por quê:</strong> ${processo.porque_processo || '-'}</p>
                            <p class="mb-0"><strong>Objetivos:</strong> ${processo.objetivos || '-'}</p>
                        </div>
                    </div>
                </div>
                <div class="col-12">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h6 class="fw-bold mb-0">Tarefas</h6>
                        <button class="btn btn-sm btn-success" onclick="abrirAdicionarTarefa('${clienteId}', '${processo.id}')">
                            <i class="bi bi-plus-lg"></i> Nova Tarefa
                        </button>
                    </div>
                    ${tarefas && tarefas.length > 0 ? `
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
                    ` : `
                        <div class="alert alert-info">
                            Nenhuma tarefa cadastrada ainda.
                        </div>
                    `}
                </div>
            </div>
        `;
        
        document.getElementById('conteudoDetalhesCliente').innerHTML = conteudo;
        
        // Abrir modal
        new bootstrap.Modal(document.getElementById('modalDetalhesCliente')).show();
        
        // ADICIONAR LISTENERS APÓS ABRIR
        setTimeout(() => {
            const btnEditar = document.getElementById('btnEditarCliente');
            const btnExcluir = document.getElementById('btnExcluirCliente');
            
            console.log('Botões encontrados:', btnEditar, btnExcluir);
            
            if (btnEditar) {
                btnEditar.onclick = () => {
                    console.log('Editar clicado');
                    abrirEditarCliente(clienteId);
                };
            }
            
            if (btnExcluir) {
                btnExcluir.onclick = () => {
                    console.log('Excluir clicado');
                    excluirCliente(clienteId);
                };
            }
        }, 200);
        
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
    window.location.href = 'mentor.html';
});

// Inicializar
verificarAutenticacao();

// ========== CRUD: EDITAR CLIENTE ==========

let clienteEditando = null;

// Abrir modal de edição
function abrirEditarCliente(clienteId) {
    const cliente = clienteAtual;
    
    if (!cliente) return;
    
    clienteEditando = cliente;
    
    // Preencher formulário
    document.getElementById('editClienteId').value = clienteId;
    document.getElementById('editUsuarioId').value = cliente.usuario.id || '';
    document.getElementById('editNome').value = cliente.usuario.nome;
    document.getElementById('editEmail').value = cliente.usuario.email;
    document.getElementById('editTelefone').value = cliente.usuario.telefone || '';
    document.getElementById('editEmpresa').value = cliente.empresa || '';
    document.getElementById('editNicho').value = cliente.nicho_atuacao || '';
    
    // Fechar modal de detalhes
    bootstrap.Modal.getInstance(document.getElementById('modalDetalhesCliente')).hide();
    
    // Abrir modal de edição
    new bootstrap.Modal(document.getElementById('modalEditarCliente')).show();
}

// Salvar edição
document.getElementById('btnSalvarEdicao')?.addEventListener('click', async () => {
    const form = document.getElementById('formEditarCliente');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const clienteId = document.getElementById('editClienteId').value;
    const usuarioId = document.getElementById('editUsuarioId').value;
    
    const dados = {
        nome: document.getElementById('editNome').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        telefone: removerMascaraTelefone(document.getElementById('editTelefone').value.trim())
        empresa: document.getElementById('editEmpresa').value.trim(),
        nicho: document.getElementById('editNicho').value.trim()
    };
    
    const btnSalvar = document.getElementById('btnSalvarEdicao');
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Salvando...';
    
    try {
        // Atualizar usuário
        const { error: usuarioError } = await supabase
            .from('appgi_mentoria_usuarios')
            .update({
                nome: dados.nome,
                email: dados.email,
                telefone: dados.telefone
            })
            .eq('id', usuarioId);
        
        if (usuarioError) throw usuarioError;
        
        // Atualizar cliente
        const { error: clienteError } = await supabase
            .from('appgi_mentoria_clientes')
            .update({
                empresa: dados.empresa,
                nicho_atuacao: dados.nicho
            })
            .eq('id', clienteId);
        
        if (clienteError) throw clienteError;
        
        alert('Cliente atualizado com sucesso!');
        
        // Fechar modal
        bootstrap.Modal.getInstance(document.getElementById('modalEditarCliente')).hide();
        
        // Recarregar lista
        carregarClientes();
        
    } catch (error) {
        console.error('Erro ao atualizar:', error);
        alert(`Erro ao atualizar cliente: ${error.message}`);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = 'Salvar';
    }
});


// ========== CRUD: EXCLUIR CLIENTE ==========

function excluirCliente(clienteId) {
    if (!confirm('Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita e irá remover:\n\n- Dados do cliente\n- Processo de mentoria\n- Todas as tarefas\n\nDeseja continuar?')) {
        return;
    }
    
    excluirClienteConfirmado(clienteId);
}

async function excluirClienteConfirmado(clienteId) {
    try {
        // 1. Deletar tarefas
        const { error: tarefasError } = await supabase
            .from('appgi_mentoria_tarefas')
            .delete()
            .eq('cliente_id', clienteId);
        
        if (tarefasError) throw tarefasError;
        
        // 2. Deletar processos
        const { error: processoError } = await supabase
            .from('appgi_mentoria_processos')
            .delete()
            .eq('cliente_id', clienteId);
        
        if (processoError) throw processoError;
        
        // 3. Buscar usuario_id do cliente
        const { data: cliente, error: clienteError } = await supabase
            .from('appgi_mentoria_clientes')
            .select('usuario_id')
            .eq('id', clienteId)
            .single();
        
        if (clienteError) throw clienteError;
        
        // 4. Deletar cliente
        const { error: deleteClienteError } = await supabase
            .from('appgi_mentoria_clientes')
            .delete()
            .eq('id', clienteId);
        
        if (deleteClienteError) throw deleteClienteError;
        
        // 5. Deletar usuário
        const { error: usuarioError } = await supabase
            .from('appgi_mentoria_usuarios')
            .delete()
            .eq('id', cliente.usuario_id);
        
        if (usuarioError) throw usuarioError;
        
        alert('Cliente excluído com sucesso!');
        
        // Fechar modal
        const modalDetalhes = bootstrap.Modal.getInstance(document.getElementById('modalDetalhesCliente'));
        if (modalDetalhes) modalDetalhes.hide();
        
        // Recarregar lista
        carregarClientes();
        
    } catch (error) {
        console.error('Erro ao excluir:', error);
        alert(`Erro ao excluir cliente: ${error.message}`);
    }
}


// ========== CRUD: ADICIONAR TAREFA ==========

let processoAtual = null;

function abrirAdicionarTarefa(clienteId, processoId) {
    document.getElementById('novaTarefaClienteId').value = clienteId;
    document.getElementById('novaTarefaProcessoId').value = processoId;
    
    // Limpar form
    document.getElementById('formAdicionarTarefa').reset();
    
    // Sugerir datas (próxima semana)
    const hoje = new Date();
    const proximaSegunda = new Date(hoje);
    proximaSegunda.setDate(hoje.getDate() + (7 - hoje.getDay() + 1));
    
    const proximoDomingo = new Date(proximaSegunda);
    proximoDomingo.setDate(proximaSegunda.getDate() + 6);
    
    document.getElementById('novaTarefaDataInicio').value = proximaSegunda.toISOString().split('T')[0];
    document.getElementById('novaTarefaDataPrazo').value = proximoDomingo.toISOString().split('T')[0];
    
    // Fechar modal de detalhes
    bootstrap.Modal.getInstance(document.getElementById('modalDetalhesCliente')).hide();
    
    // Abrir modal de nova tarefa
    new bootstrap.Modal(document.getElementById('modalAdicionarTarefa')).show();
}

// Salvar nova tarefa
document.getElementById('btnSalvarNovaTarefa')?.addEventListener('click', async () => {
    const form = document.getElementById('formAdicionarTarefa');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const clienteId = document.getElementById('novaTarefaClienteId').value;
    const processoId = document.getElementById('novaTarefaProcessoId').value;
    
    const dados = {
        titulo: document.getElementById('novaTarefaTitulo').value.trim(),
        descricao: document.getElementById('novaTarefaDescricao').value.trim(),
        data_inicio: document.getElementById('novaTarefaDataInicio').value,
        data_prazo: document.getElementById('novaTarefaDataPrazo').value
    };
    
    const btnSalvar = document.getElementById('btnSalvarNovaTarefa');
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Salvando...';
    
    try {
        // Buscar última semana cadastrada
        const { data: tarefas, error: tarefasError } = await supabase
            .from('appgi_mentoria_tarefas')
            .select('semana')
            .eq('cliente_id', clienteId)
            .order('semana', { ascending: false })
            .limit(1);
        
        if (tarefasError) throw tarefasError;
        
        const proximaSemana = tarefas && tarefas.length > 0 ? tarefas[0].semana + 1 : 1;
        
        // Inserir nova tarefa
        const { error: insertError } = await supabase
            .from('appgi_mentoria_tarefas')
            .insert({
                processo_id: processoId,
                mentor_id: usuarioLogado.id,
                cliente_id: clienteId,
                semana: proximaSemana,
                titulo: dados.titulo,
                descricao: dados.descricao,
                data_inicio: dados.data_inicio,
                data_prazo: dados.data_prazo,
                status: 'a_iniciar'
            });
        
        if (insertError) throw insertError;
        
        alert('Tarefa adicionada com sucesso!');
        
        // Fechar modal
        bootstrap.Modal.getInstance(document.getElementById('modalAdicionarTarefa')).hide();
        
        // Reabrir detalhes do cliente
        verDetalhesCliente(clienteId);
        
    } catch (error) {
        console.error('Erro ao adicionar tarefa:', error);
        alert(`Erro ao adicionar tarefa: ${error.message}`);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = 'Adicionar';
    }
});

// ========== MÁSCARA DE TELEFONE ==========

function aplicarMascaraTelefone(event) {
    let valor = event.target.value.replace(/\D/g, ''); // Remove tudo que não é número
    
    if (valor.length <= 11) {
        // (00) 00000.00.00 para celular ou (00) 0000.00.00 para fixo
        if (valor.length > 10) {
            // Celular com 11 dígitos
            valor = valor.replace(/^(\d{2})(\d{5})(\d{2})(\d{2})$/, '($1) $2.$3.$4');
        } else if (valor.length > 6) {
            // Intermediário
            valor = valor.replace(/^(\d{2})(\d{4,5})(\d{0,2})(\d{0,2})/, '($1) $2.$3.$4');
            valor = valor.replace(/\.\.$/, '.'); // Remove ponto duplo
        } else if (valor.length > 2) {
            // Apenas DDD
            valor = valor.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
        }
    }
    
    event.target.value = valor.trim().replace(/\.$/, ''); // Remove ponto final
}

// Remover formatação antes de salvar
function removerMascaraTelefone(telefone) {
    return telefone.replace(/\D/g, ''); // Remove tudo que não é número
}

// Formatar telefone para exibição
function formatarTelefone(telefone) {
    if (!telefone) return '';
    
    telefone = telefone.replace(/\D/g, '');
    
    if (telefone.length === 11) {
        // Celular: (00) 00000.00.00
        return telefone.replace(/^(\d{2})(\d{5})(\d{2})(\d{2})$/, '($1) $2.$3.$4');
    } else if (telefone.length === 10) {
        // Fixo: (00) 0000.00.00
        return telefone.replace(/^(\d{2})(\d{4})(\d{2})(\d{2})$/, '($1) $2.$3.$4');
    }
    
    return telefone;
}

// Aplicar máscara nos campos de telefone
document.addEventListener('DOMContentLoaded', () => {
    const camposTelefone = ['telefoneCliente', 'editTelefone'];
    
    camposTelefone.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.addEventListener('input', aplicarMascaraTelefone);
        }
    });
});


// Remover formatação antes de salvar
function removerMascaraTelefone(telefone) {
    return telefone.replace(/\D/g, ''); // Remove tudo que não é número
}

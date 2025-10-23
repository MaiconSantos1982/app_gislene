let usuarioLogado = null;
let clienteData = null;
let todasTarefas = [];
let filtroAtual = 'todas';

// Verificar autenticação
async function verificarAutenticacao() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    
    // Buscar dados do usuário
    const { data: usuario, error } = await supabase
        .from('appgi_mentoria_usuarios')
        .select('*')
        .eq('auth_id', session.user.id)
        .single();
    
    if (error || !usuario || usuario.tipo !== 'cliente') {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
        return;
    }
    
    usuarioLogado = usuario;
    document.getElementById('nomeCliente').textContent = usuario.nome;
    
    // Carregar dados do cliente
    await carregarDadosCliente();
}

// Carregar dados do cliente
async function carregarDadosCliente() {
    try {
        // Buscar dados do cliente
        const { data: cliente, error: clienteError } = await supabase
            .from('appgi_mentoria_clientes')
            .select('id')
            .eq('usuario_id', usuarioLogado.id)
            .single();
        
        if (clienteError) throw clienteError;
        
        clienteData = cliente;
        
        // Buscar estatísticas do dashboard
        const { data: stats, error: statsError } = await supabase
            .from('appgi_dashboard_cliente')
            .select('*')
            .eq('usuario_id', usuarioLogado.id)
            .single();
        
        if (statsError) {
            console.error('Erro ao buscar stats:', statsError);
        } else {
            atualizarDashboard(stats);
        }
        
        // Carregar tarefas
        await carregarTarefas();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        alert('Erro ao carregar seus dados. Tente novamente.');
    }
}

// Atualizar dashboard
function atualizarDashboard(stats) {
    // Progresso
    const percentual = stats.percentual_conclusao || 0;
    document.getElementById('percentualProgresso').textContent = `${percentual}%`;
    document.getElementById('barraProgresso').style.width = `${percentual}%`;
    
    // Semanas
    document.getElementById('semanaAtual').textContent = stats.semana_atual || '-';
    document.getElementById('duracaoTotal').textContent = stats.duracao_semanas || '-';
    
    // Tarefas
    document.getElementById('tarefasConcluidas').textContent = stats.tarefas_concluidas || 0;
    document.getElementById('tarefasTotal').textContent = stats.total_tarefas || 0;
    document.getElementById('tarefasPendentes').textContent = 
        (stats.tarefas_pendentes || 0) + (stats.tarefas_em_andamento || 0);
    document.getElementById('tarefasAtrasadas').textContent = stats.tarefas_atrasadas || 0;
}

// Carregar tarefas
async function carregarTarefas() {
    try {
        const { data: tarefas, error } = await supabase
            .from('appgi_mentoria_tarefas')
            .select('*')
            .eq('cliente_id', clienteData.id)
            .order('semana', { ascending: true });
        
        if (error) throw error;
        
        todasTarefas = tarefas;
        
        // Mostrar próxima tarefa
        mostrarProximaTarefa(tarefas);
        
        // Renderizar lista
        renderizarTarefas();
        
    } catch (error) {
        console.error('Erro ao carregar tarefas:', error);
        document.getElementById('listaTarefas').innerHTML = `
            <div class="text-center text-danger py-4">
                Erro ao carregar tarefas
            </div>
        `;
    }
}

// Mostrar próxima tarefa
function mostrarProximaTarefa(tarefas) {
    const hoje = new Date().toISOString().split('T')[0];
    
    // Buscar primeira tarefa não concluída que não está atrasada
    const proximaTarefa = tarefas.find(t => 
        t.status !== 'concluido' && t.data_prazo >= hoje
    );
    
    if (proximaTarefa) {
        document.getElementById('cardProximaTarefa').style.display = 'block';
        document.getElementById('proximaTarefaTitulo').textContent = proximaTarefa.titulo;
        document.getElementById('proximaTarefaDescricao').textContent = 
            proximaTarefa.descricao || 'Sem descrição';
        document.getElementById('proximaTarefaPrazo').textContent = 
            formatarData(proximaTarefa.data_prazo);
    }
}

// Renderizar tarefas
function renderizarTarefas() {
    let tarefasFiltradas = todasTarefas;
    
    // Aplicar filtro
    if (filtroAtual === 'pendentes') {
        tarefasFiltradas = todasTarefas.filter(t => 
            t.status === 'a_iniciar' || t.status === 'em_andamento'
        );
    } else if (filtroAtual === 'concluidas') {
        tarefasFiltradas = todasTarefas.filter(t => t.status === 'concluido');
    }
    
    const container = document.getElementById('listaTarefas');
    
    if (tarefasFiltradas.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                Nenhuma tarefa encontrada
            </div>
        `;
        return;
    }
    
    const hoje = new Date().toISOString().split('T')[0];
    
    container.innerHTML = tarefasFiltradas.map(tarefa => {
        const statusAtrasada = tarefa.data_prazo < hoje && tarefa.status !== 'concluido';
        const statusClass = {
            'a_iniciar': 'secondary',
            'em_andamento': 'primary',
            'concluido': 'success'
        };
        const statusTexto = {
            'a_iniciar': 'A Iniciar',
            'em_andamento': 'Em Andamento',
            'concluido': 'Concluído'
        };
        
        return `
            <div class="card mb-3 ${statusAtrasada ? 'border-danger' : ''}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <small class="text-muted">Semana ${tarefa.semana}</small>
                            <h6 class="mb-1">${tarefa.titulo}</h6>
                        </div>
                        <span class="badge bg-${statusAtrasada ? 'danger' : statusClass[tarefa.status]}">
                            ${statusAtrasada ? 'Atrasada' : statusTexto[tarefa.status]}
                        </span>
                    </div>
                    
                    ${tarefa.descricao ? `<p class="text-muted small mb-2">${tarefa.descricao}</p>` : ''}
                    
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            <i class="bi bi-calendar-event me-1"></i>
                            ${formatarData(tarefa.data_prazo)}
                        </small>
                        <button class="btn btn-sm btn-outline-primary" 
                            onclick="verDetalhesTarefa('${tarefa.id}')">
                            Ver Detalhes
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Ver detalhes da tarefa
async function verDetalhesTarefa(tarefaId) {
    const tarefa = todasTarefas.find(t => t.id === tarefaId);
    
    if (!tarefa) return;
    
    const hoje = new Date().toISOString().split('T')[0];
    const statusAtrasada = tarefa.data_prazo < hoje && tarefa.status !== 'concluido';
    
    const conteudo = `
        <div class="mb-3">
            <label class="form-label fw-bold">Semana</label>
            <p class="form-control-plaintext">${tarefa.semana}</p>
        </div>
        
        <div class="mb-3">
            <label class="form-label fw-bold">Título</label>
            <p class="form-control-plaintext">${tarefa.titulo}</p>
        </div>
        
        <div class="mb-3">
            <label class="form-label fw-bold">Descrição</label>
            <p class="form-control-plaintext">${tarefa.descricao || 'Sem descrição'}</p>
        </div>
        
        <div class="row mb-3">
            <div class="col-6">
                <label class="form-label fw-bold">Data Início</label>
                <p class="form-control-plaintext">${formatarData(tarefa.data_inicio)}</p>
            </div>
            <div class="col-6">
                <label class="form-label fw-bold">Data Prazo</label>
                <p class="form-control-plaintext ${statusAtrasada ? 'text-danger' : ''}">
                    ${formatarData(tarefa.data_prazo)}
                    ${statusAtrasada ? '<i class="bi bi-exclamation-triangle ms-1"></i>' : ''}
                </p>
            </div>
        </div>
        
        ${tarefa.observacoes_mentor ? `
            <div class="mb-3">
                <label class="form-label fw-bold">Observações do Mentor</label>
                <div class="alert alert-info mb-0">
                    ${tarefa.observacoes_mentor}
                </div>
            </div>
        ` : ''}
        
        <form id="formAtualizarTarefa">
            <div class="mb-3">
                <label for="statusTarefa" class="form-label fw-bold">Status</label>
                <select class="form-select" id="statusTarefa" required>
                    <option value="a_iniciar" ${tarefa.status === 'a_iniciar' ? 'selected' : ''}>A Iniciar</option>
                    <option value="em_andamento" ${tarefa.status === 'em_andamento' ? 'selected' : ''}>Em Andamento</option>
                    <option value="concluido" ${tarefa.status === 'concluido' ? 'selected' : ''}>Concluído</option>
                </select>
            </div>
            
            <div class="mb-3">
                <label for="observacoesCliente" class="form-label fw-bold">Suas Observações</label>
                <textarea class="form-control" id="observacoesCliente" rows="4">${tarefa.observacoes_cliente || ''}</textarea>
                <small class="text-muted">Compartilhe seu progresso, dúvidas ou feedback sobre esta tarefa</small>
            </div>
            
            <button type="submit" class="btn btn-primary w-100">
                <i class="bi bi-check-circle me-2"></i>Salvar Alterações
            </button>
        </form>
    `;
    
    document.getElementById('modalTarefaTitulo').textContent = tarefa.titulo;
    document.getElementById('modalTarefaConteudo').innerHTML = conteudo;
    
    // Event listener para o form
    document.getElementById('formAtualizarTarefa').addEventListener('submit', async (e) => {
        e.preventDefault();
        await atualizarTarefa(tarefaId);
    });
    
    // Abrir modal
    new bootstrap.Modal(document.getElementById('modalDetalhesTarefa')).show();
}

// Atualizar tarefa
async function atualizarTarefa(tarefaId) {
    const status = document.getElementById('statusTarefa').value;
    const observacoes = document.getElementById('observacoesCliente').value.trim();
    
    try {
        const { error } = await supabase
            .from('appgi_mentoria_tarefas')
            .update({
                status: status,
                observacoes_cliente: observacoes
            })
            .eq('id', tarefaId);
        
        if (error) throw error;
        
        // Fechar modal
        bootstrap.Modal.getInstance(document.getElementById('modalDetalhesTarefa')).hide();
        
        // Recarregar dados
        await carregarDadosCliente();
        
        alert('Tarefa atualizada com sucesso!');
        
    } catch (error) {
        console.error('Erro ao atualizar tarefa:', error);
        alert('Erro ao atualizar tarefa. Tente novamente.');
    }
}

// Formatar data
function formatarData(dataString) {
    const data = new Date(dataString + 'T00:00:00');
    return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Filtros
document.querySelectorAll('input[name="filtroStatus"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        filtroAtual = e.target.value;
        renderizarTarefas();
    });
});

// Logout
document.getElementById('btnLogoutCliente')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    window.location.href = 'index.html';
});

// Inicializar
verificarAutenticacao();

# Como colocar o painel no ar (Supabase + hospedagem)

## 1. Criar o projeto no Supabase (5 min)
1. Acesse https://supabase.com, crie uma conta e um novo projeto (escolha uma senha de banco forte e guarde-a).
2. Aguarde o projeto provisionar.
3. No menu lateral, vá em **SQL Editor > New query**, cole todo o conteúdo do arquivo `supabase/schema.sql` deste repositório e clique em **Run**. Isso cria as tabelas `assessorias` e `assessoria_clientes` com as regras de segurança (cada consultor só vê e edita as próprias assessorias; cada cliente só lê a assessoria para a qual foi convidado).
4. Vá em **Authentication > Providers** e confirme que **Email** está habilitado (é o padrão).
5. (Recomendado para agilizar hoje) Em **Authentication > Sign In / Providers > Email**, desative "Confirm email" temporariamente — assim você e seus clientes conseguem entrar direto após criar a conta, sem precisar clicar em link de confirmação. Pode reativar depois com calma.
6. Vá em **Project Settings > API** e copie a **Project URL** e a **anon public key**.

## 2. Configurar o projeto
Abra `js/supabase-config.js` e cole os dois valores:

```js
window.SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
window.SUPABASE_ANON_KEY = 'SUA-CHAVE-ANON-PUBLICA-AQUI';
```

## 3. Testar localmente
Não abra os arquivos `.html` direto no navegador (módulos JS não funcionam via `file://`). Rode um servidor simples na pasta do projeto:

```bash
python3 -m http.server 8080
```

E acesse `http://localhost:8080`.

## 4. Primeiro acesso (você, como consultor)
1. Abra o site, clique em **Criar conta**, cadastre seu e-mail/senha.
2. Você cai em "Minhas Assessorias" — clique em **+ Nova assessoria** e crie a primeira, com o mesmo nome do projeto original ("Projeto B+P — VR Painéis").
3. Abra a assessoria recém-criada e clique em **↑ Restaurar de arquivo**, selecionando `supabase/seed_vr_paineis_backup.json` — isso importa as 3 visitas que já estavam registradas no HTML original, sem precisar redigitar nada.
4. Dali em diante, registre as visitas normalmente — tudo é salvo no Supabase automaticamente (indicador "Salvo" no topo).

## 5. Dar acesso a um cliente
1. Na tela "Minhas Assessorias", no card da assessoria dele, clique em **Compartilhar com cliente** e informe o e-mail dele.
2. Peça para o cliente acessar o site, clicar em **Criar conta** usando **exatamente esse mesmo e-mail**, e pronto — ele cai direto no painel dele, em modo somente leitura (não pode editar visitas, só ver o progresso e emitir o relatório).

## 6. Publicar de verdade (para acessar de qualquer máquina)
Como é um site estático (HTML/JS puro), qualquer uma destas opções funciona sem precisar de servidor próprio:
- **Netlify** (mais simples): arraste a pasta do projeto em https://app.netlify.com/drop.
- **Vercel**: `vercel deploy` na pasta do projeto (ou importar o repositório do GitHub).
- **GitHub Pages**: em Settings > Pages do repositório, aponte para a branch/pasta atual.

Depois de publicado, tanto você quanto os clientes acessam pelo link público — sem precisar mais de backup/importação manual entre máquinas, porque os dados moram no Supabase.

## O que já mudou em relação ao HTML original
- Os dados (etapas, visitas, entregáveis) agora ficam em uma linha da tabela `assessorias` no Supabase, não mais no `localStorage` do navegador.
- Login com e-mail/senha via Supabase Auth. Você (dono) tem edição completa; cada cliente convidado só enxerga a própria assessoria, em modo leitura.
- Uma tela nova, `painel.html`, lista todas as suas assessorias vigentes — antes só existia uma (fixa, "Projeto B+P — VR Painéis").
- O botão "Baixar cópia (JSON)" continua existindo (bom para um backup extra pontual); "Restaurar de arquivo" ficou restrito ao consultor.

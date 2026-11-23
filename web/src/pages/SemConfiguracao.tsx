export default function SemConfiguracao() {
  return (
    <main className="config">
      <h1 className="titulo-m">Falta conectar o banco de dados</h1>
      <p className="subtitulo">O app não encontrou o endereço e a chave do Supabase.</p>
      <ol>
        <li>Copie <code>web/.env.example</code> para <code>web/.env.local</code>.</li>
        <li>Para testar no computador: abra o Docker Desktop e rode <code>npx supabase start</code> na pasta do projeto.</li>
        <li>Cole a <em>API URL</em> e a <em>anon key</em> exibidas em <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.</li>
        <li>Reinicie <code>npm run dev</code>.</li>
      </ol>
    </main>
  )
}

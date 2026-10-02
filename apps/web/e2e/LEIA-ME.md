# Verificação visual em celular

Ferramentas para ver e medir o app em tela pequena **sem Supabase real**. Não rodam no CI (precisam de navegador).

```bash
npm i -D playwright && npx playwright install chromium     # uma vez
node e2e/supabase-simulado.mjs &                           # :54321 — PAPEL=produtor para o portal do produtor
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=x npx next dev -p 3111 &
node e2e/medir-mobile.mjs 390 844 /tmp/capturas topo /app /app/talhoes /app/agenda
```

Cada linha de saída traz: rolagem lateral da página (deve ser "não"), quantos alvos de toque têm menos de 36 px
e os elementos que estouram a largura. As capturas (PNG) ficam na pasta indicada. Larguras usadas na revisão:
360×740, 390×844 e 768×1024. No Git Bash do Windows use `MSYS_NO_PATHCONV=1` para os caminhos começados em `/`.

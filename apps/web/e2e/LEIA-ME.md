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

## Provar que uma refatoração não mudou nada

```bash
# antes de mexer: simulador + build de produção rodando em :54321 e :3111
node e2e/fotografar-html.mjs  /tmp/antes   consultor     # HTML de cada página e de cada aba
node e2e/fotografar-html.mjs  /tmp/antes-p produtor
node e2e/comparar-pixels.mjs  /tmp/px-antes 390          # telas completas (CSS)
# ... refatore, rebuild, reinicie o servidor ...
node e2e/fotografar-html.mjs  /tmp/depois  consultor && diff -r /tmp/antes /tmp/depois
node e2e/comparar-pixels.mjs  /tmp/px-depois 390 && for f in /tmp/px-antes/*.png; do cmp "$f" "/tmp/px-depois/$(basename $f)"; done
```

Capturas do mesmo código duas vezes seguidas precisam sair idênticas (confira antes de confiar na comparação).
O mapa Leaflet e as horas relativas do simulador são as únicas fontes de ruído conhecidas.
`medir-tempo.mjs` (com `LATENCIA_MS=100 LOG=1` no simulador) mede o início da resposta e as chamadas ao banco por página.

## Conferir a CSP

A Content-Security-Policy (nonce por requisição, `lib/csp.ts`, montada no `middleware.ts`) só se prova num navegador:
`node e2e/verificar-csp.mjs /login /app /app/config/equipe` lista violações ("Refused to…"), erros de JS e se cada página hidratou.
Em http local o logout (`/sair`) só passa se você abrir o site pelo MESMO host que o servidor enxerga (use `localhost`, não `127.0.0.1`):
o `form-action 'self'` também vale para o destino do redirect.

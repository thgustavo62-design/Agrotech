'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { criarClienteNavegador } from '@/lib/supabase/client';
import { IconeBusca, IconeFechar } from './icones';

interface Resultado {
  grupo: string;
  rotulo: string;
  detalhe?: string;
  href: string;
}

const ACOES_RAPIDAS: Resultado[] = [
  { grupo: 'Ações rápidas', rotulo: 'Novo produtor', href: '/app/produtores/nova' },
  { grupo: 'Ações rápidas', rotulo: 'Lançar análise', href: '/app/analises/nova' },
  { grupo: 'Ações rápidas', rotulo: 'Enviar laudo (PDF)', href: '/app/laudos/novo' },
];

/**
 * Busca global (Ctrl/Cmd+K). Consulta produtores/propriedades/talhões com
 * `ilike` simples — sem full-text search: a base por organização é pequena
 * o bastante para não justificar tsvector/índice GIN ainda
 * (ver docs/UX_ARCHITECTURE.md §8.3).
 */
export function PaletaComandos() {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [realce, setRealce] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAberta((v) => !v);
      }
      if (e.key === 'Escape') setAberta(false);
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  useEffect(() => {
    if (aberta) setTimeout(() => inputRef.current?.focus(), 30);
    else { setTermo(''); setResultados([]); }
  }, [aberta]);

  const buscar = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResultados([]); return; }
    setCarregando(true);
    const sb = criarClienteNavegador();
    const padrao = `%${q.trim()}%`;
    const [{ data: produtores }, { data: propriedades }, { data: talhoes }] = await Promise.all([
      sb.schema('agro').from('produtores').select('id, nome').ilike('nome', padrao).limit(5),
      sb.schema('agro').from('propriedades').select('id, nome, produtor:produtor_id(id, nome)').ilike('nome', padrao).limit(5),
      sb.schema('agro').from('talhoes').select('id, nome, cultura, propriedade:propriedade_id(produtor:produtor_id(nome))').ilike('nome', padrao).limit(5),
    ]);

    const achados: Resultado[] = [
      ...(produtores ?? []).map((p) => ({ grupo: 'Produtores', rotulo: p.nome as string, href: `/app/produtores/${p.id}` })),
      ...(propriedades ?? []).map((p) => ({
        grupo: 'Propriedades', rotulo: p.nome as string,
        // deno-lint-ignore no-explicit-any
        detalhe: (p as any).produtor?.nome, href: `/app/produtores/${(p as any).produtor?.id ?? ''}`,
      })),
      ...(talhoes ?? []).map((t) => ({
        grupo: 'Talhões', rotulo: t.nome as string,
        // deno-lint-ignore no-explicit-any
        detalhe: (t as any).propriedade?.produtor?.nome, href: `/app/talhoes/${t.id}`,
      })),
    ];
    setResultados(achados);
    setRealce(0);
    setCarregando(false);
  }, []);

  function aoDigitar(v: string) {
    setTermo(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => buscar(v), 220);
  }

  const listaAcoes = ACOES_RAPIDAS.filter((a) => !termo.trim() || a.rotulo.toLowerCase().includes(termo.trim().toLowerCase()));
  const lista = [...listaAcoes, ...resultados];

  function selecionar(r: Resultado) {
    setAberta(false);
    router.push(r.href);
  }

  function aoTeclarLista(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setRealce((i) => Math.min(i + 1, lista.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setRealce((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && lista[realce]) { e.preventDefault(); selecionar(lista[realce]!); }
  }

  const agrupados = lista.reduce<Record<string, Resultado[]>>((acc, r) => {
    (acc[r.grupo] ??= []).push(r);
    return acc;
  }, {});

  return (
    <>
      <button type="button" className="busca-gatilho" onClick={() => setAberta(true)}>
        <IconeBusca width={15} height={15} />
        Buscar produtor, talhão…
        <kbd>{typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      {aberta && (
        <div className="paleta-fundo" onClick={(e) => { if (e.target === e.currentTarget) setAberta(false); }}>
          <div className="paleta" role="dialog" aria-modal="true" aria-label="Busca">
            <input
              ref={inputRef}
              value={termo}
              onChange={(e) => aoDigitar(e.target.value)}
              onKeyDown={aoTeclarLista}
              placeholder="Buscar produtor, propriedade, talhão… ou uma ação"
              autoComplete="off"
            />
            <div className="paleta-lista">
              {carregando && termo.trim().length >= 2 ? <div className="paleta-vazio">Buscando…</div> : null}
              {!carregando && termo.trim().length >= 2 && resultados.length === 0 && listaAcoes.length === 0 ? (
                <div className="paleta-vazio">Nada encontrado para &ldquo;{termo}&rdquo;.</div>
              ) : null}
              {Object.entries(agrupados).map(([grupo, itens]) => (
                <div key={grupo}>
                  <div className="paleta-grupo-titulo">{grupo}</div>
                  {itens.map((r) => {
                    const indice = lista.indexOf(r);
                    return (
                      <button
                        key={`${r.grupo}-${r.href}-${r.rotulo}`}
                        type="button"
                        className="paleta-item"
                        data-realce={indice === realce}
                        onMouseEnter={() => setRealce(indice)}
                        onClick={() => selecionar(r)}
                      >
                        {r.rotulo}
                        {r.detalhe ? <small>{r.detalhe}</small> : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

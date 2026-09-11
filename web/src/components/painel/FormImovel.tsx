"use client";
import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/painel/acoes";
import { TIPOS } from "@/lib/format";
import type { ImovelEdicao } from "@/lib/painel";
import { STATUS_IMOVEL } from "@/lib/painel-rotulos";
import EditorFotos from "./EditorFotos";
import EditorTags from "./EditorTags";
import MapaPicker from "./MapaPicker";
import { Aviso, Campo, cls } from "./ui";

interface Props {
  imovel: ImovelEdicao | null;
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  bairros: { bairro: string; cidade: string }[];
  caracteristicasSugeridas: string[];
  imobiliariaId?: number | null;
}

const fmtNum = (v: number | null | undefined, casas = 0) =>
  v == null ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });

function Secao({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <section className={`${cls.cartao} p-4 sm:p-5`}>
      <h2 className="font-semibold">{titulo}</h2>
      {dica && <p className="mb-3 mt-0.5 text-xs text-muted">{dica}</p>}
      {!dica && <div className="mb-3" />}
      {children}
    </section>
  );
}

export default function FormImovel({ imovel, acao, bairros, caracteristicasSugeridas, imobiliariaId }: Props) {
  const [estado, enviar, pendente] = useActionState(acao, {} as EstadoForm);
  const [fin, setFin] = useState(imovel?.finalidade ?? "venda");
  const [sobConsulta, setSobConsulta] = useState(!!imovel && imovel.preco == null && imovel.preco_aluguel == null);
  const [lat, setLat] = useState<string>(imovel?.latitude != null ? String(imovel.latitude) : "");
  const [lng, setLng] = useState<string>(imovel?.longitude != null ? String(imovel.longitude) : "");
  const [cidade, setCidade] = useState(imovel?.cidade ?? "Itajubá");
  const e = estado.erros ?? {};
  const latN = Number(lat.replace(",", "."));
  const lngN = Number(lng.replace(",", "."));
  const temCoord = lat !== "" && lng !== "" && isFinite(latN) && isFinite(lngN);
  const cidades = [...new Set(bairros.map((b) => b.cidade))];
  const bairrosDaCidade = bairros.filter((b) => b.cidade.localeCompare(cidade, "pt-BR", { sensitivity: "base" }) === 0).map((b) => b.bairro);
  const coletado = imovel?.origem === "scraper";

  return (
    <form action={enviar} className="space-y-4">
      {imovel && <input type="hidden" name="id" value={imovel.id} />}
      {!imovel && imobiliariaId && <input type="hidden" name="imobiliaria_id" value={imobiliariaId} />}
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}

      <Secao titulo="Básico">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Tipo" erro={e.tipo}>
            <select name="tipo" defaultValue={imovel?.tipo ?? "casa"} className={cls.select} required>
              {Object.entries(TIPOS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Finalidade" erro={e.finalidade}>
            <select name="finalidade" value={fin} onChange={(ev) => setFin(ev.target.value)} className={cls.select}>
              <option value="venda">Venda</option>
              <option value="aluguel">Aluguel</option>
              <option value="venda_aluguel">Venda ou aluguel</option>
            </select>
          </Campo>
          <Campo rotulo="Código / referência" dica="Como aparece no seu sistema.">
            <input name="codigo" defaultValue={imovel?.codigo ?? ""} className={cls.input} maxLength={40} />
          </Campo>
          <Campo rotulo="Status" erro={e.status}>
            <select name="status" defaultValue={imovel?.status ?? "disponivel"} className={cls.select}>
              {Object.entries(STATUS_IMOVEL)
                .filter(([k]) => k !== "removido" || imovel?.status === "removido")
                .map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Título do anúncio" className="mt-3" dica="Opcional. Sem título, o site monta um a partir do tipo, quartos e bairro.">
          <input name="titulo" defaultValue={imovel?.titulo ?? ""} className={cls.input} maxLength={200} placeholder="Ex.: Casa com quintal amplo perto da UNIFEI" />
        </Campo>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="destaque" defaultChecked={!!imovel?.destaque} className="h-4 w-4 accent-[var(--accent)]" />
            Destacar na busca
          </label>
          {coletado && (
            <label className="flex items-center gap-2" title="Sem isto, a próxima coleta automática do site da imobiliária sobrescreve o que você editar aqui.">
              <input type="checkbox" name="travado" defaultChecked={!!imovel.travado} className="h-4 w-4 accent-[var(--accent)]" />
              Proteger da coleta automática
            </label>
          )}
        </div>
      </Secao>

      <Secao titulo="Valores" dica="Use vírgula para centavos se precisar: 450.000 ou 450000 valem igual.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {fin !== "aluguel" && (
            <Campo rotulo="Preço de venda (R$)" erro={e.preco}>
              <input name="preco" defaultValue={fmtNum(imovel?.preco)} inputMode="decimal" className={cls.input} disabled={sobConsulta && fin === "venda"} />
            </Campo>
          )}
          {fin !== "venda" && (
            <Campo rotulo="Aluguel (R$/mês)" erro={e.preco_aluguel}>
              <input name="preco_aluguel" defaultValue={fmtNum(imovel?.preco_aluguel)} inputMode="decimal" className={cls.input} disabled={sobConsulta && fin === "aluguel"} />
            </Campo>
          )}
          <Campo rotulo="Condomínio (R$/mês)">
            <input name="condominio" defaultValue={fmtNum(imovel?.condominio)} inputMode="decimal" className={cls.input} />
          </Campo>
          <Campo rotulo="IPTU (R$)">
            <input name="iptu" defaultValue={fmtNum(imovel?.iptu)} inputMode="decimal" className={cls.input} />
          </Campo>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="sob_consulta" checked={sobConsulta} onChange={(ev) => setSobConsulta(ev.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Preço sob consulta
        </label>
      </Secao>

      <Secao titulo="Áreas e cômodos" dica="Deixe em branco o que não se aplica (terreno sem quartos, por exemplo).">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Campo rotulo="Área útil (m²)"><input name="area_util" defaultValue={fmtNum(imovel?.area_util, 2)} inputMode="decimal" className={cls.input} /></Campo>
          <Campo rotulo="Área total (m²)"><input name="area_total" defaultValue={fmtNum(imovel?.area_total, 2)} inputMode="decimal" className={cls.input} /></Campo>
          <Campo rotulo="Quartos"><input name="quartos" defaultValue={imovel?.quartos ?? ""} inputMode="numeric" className={cls.input} /></Campo>
          <Campo rotulo="Suítes"><input name="suites" defaultValue={imovel?.suites ?? ""} inputMode="numeric" className={cls.input} /></Campo>
          <Campo rotulo="Banheiros"><input name="banheiros" defaultValue={imovel?.banheiros ?? ""} inputMode="numeric" className={cls.input} /></Campo>
          <Campo rotulo="Vagas"><input name="vagas" defaultValue={imovel?.vagas ?? ""} inputMode="numeric" className={cls.input} /></Campo>
        </div>
      </Secao>

      <Secao titulo="Localização" dica="Clique no mapa para marcar o ponto; ele é o que aparece na busca por mapa.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Endereço" className="sm:col-span-2">
            <input name="endereco" defaultValue={imovel?.endereco ?? ""} className={cls.input} maxLength={200} placeholder="Rua, número (opcional)" />
          </Campo>
          <Campo rotulo="Bairro">
            <input name="bairro" defaultValue={imovel?.bairro ?? ""} list="lista-bairros" className={cls.input} maxLength={80} />
            <datalist id="lista-bairros">
              {bairrosDaCidade.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Campo>
          <Campo rotulo="Cidade" erro={e.cidade}>
            <input name="cidade" value={cidade} onChange={(ev) => setCidade(ev.target.value)} list="lista-cidades" className={cls.input} maxLength={80} required />
            <datalist id="lista-cidades">
              {cidades.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Campo>
          <Campo rotulo="UF"><input name="uf" defaultValue={imovel?.uf ?? "MG"} className={cls.input} maxLength={2} /></Campo>
          <Campo rotulo="CEP"><input name="cep" defaultValue={imovel?.cep ?? ""} className={cls.input} maxLength={12} /></Campo>
          <Campo rotulo="Latitude" erro={e.latitude}>
            <input name="latitude" value={lat} onChange={(ev) => setLat(ev.target.value)} inputMode="decimal" className={`${cls.input} font-mono`} placeholder="-22.4256" />
          </Campo>
          <Campo rotulo="Longitude" erro={e.longitude}>
            <input name="longitude" value={lng} onChange={(ev) => setLng(ev.target.value)} inputMode="decimal" className={`${cls.input} font-mono`} placeholder="-45.4528" />
          </Campo>
        </div>
        <div className="mt-3 h-72 overflow-hidden rounded-lg border border-line">
          <MapaPicker
            lat={temCoord ? latN : null}
            lng={temCoord ? lngN : null}
            aoMudar={(a, b) => {
              setLat(a.toFixed(6));
              setLng(b.toFixed(6));
            }}
          />
        </div>
        {temCoord && (
          <button type="button" onClick={() => { setLat(""); setLng(""); }} className="mt-2 text-xs text-muted hover:text-fg">
            Limpar posição
          </button>
        )}
      </Secao>

      <Secao titulo="Fotos">
        <EditorFotos iniciais={imovel?.fotos ?? []} capaInicial={imovel?.foto_capa ?? null} />
      </Secao>

      <Secao titulo="Características" dica="Piscina, churrasqueira, portaria 24h… Entram na busca por texto.">
        <EditorTags nome="caracteristicas" iniciais={imovel?.caracteristicas ?? []} sugestoes={caracteristicasSugeridas} />
      </Secao>

      <Secao titulo="Descrição">
        <textarea name="descricao" defaultValue={imovel?.descricao ?? ""} rows={8} className={cls.input} maxLength={8000} placeholder="Conte o que o anúncio tem de bom: distribuição, estado de conservação, vizinhança, documentação…" />
        <Campo rotulo="Observações internas" className="mt-3" dica="Só a equipe vê. Chaves, proprietário, comissão, restrições.">
          <textarea name="obs_interna" defaultValue={imovel?.obs_interna ?? ""} rows={3} className={cls.input} maxLength={2000} />
        </Campo>
      </Secao>

      <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <button type="submit" disabled={pendente} className={`${cls.botao} ${cls.primario} px-5`}>
          {pendente ? "Salvando…" : imovel ? "Salvar alterações" : "Cadastrar imóvel"}
        </button>
        {estado.ok && !pendente && <span className="text-sm text-queda">{estado.ok}</span>}
        {estado.erro && !pendente && <span className="text-sm text-red-600">{estado.erro}</span>}
      </div>
    </form>
  );
}

/**
 * Utilitários de UI e formatação para o FreelaMZ.
 */

/* Formatar valor em Meticais — sempre "15 000 MT" (nunca "MTn").
   Manual porque toLocaleString('pt-MZ', { currency: 'MZN' }) devolve
   o símbolo "MTn", que o replace nunca apanhava. */
export function formatarMoeda(valor) {
  const n = Math.round(parseFloat(valor) || 0);
  const digitos = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${n < 0 ? '-' : ''}${digitos} MT`;
}
/* Alias curto (mesma função única usada em todo o app) */
export const formatMoney = formatarMoeda;

/* Formatar data */
export function formatarData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* Formatar data e hora */
export function formatarHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-MZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* Só a hora (HH:MM) — para balões de chat com separador de data */
export function horaCurta(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });
}

/* Rótulo do dia para separadores de chat: Hoje / Ontem / dd/mm/aaaa */
export function rotuloDia(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const hoje = new Date();
  const zero = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const umDia = 86400000;
  if (zero(d) === zero(hoje)) return 'Hoje';
  if (zero(d) === zero(hoje) - umDia) return 'Ontem';
  return d.toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* Iniciais do nome para avatar */
export function iniciais(nome) {
  if (!nome) return '?';
  return nome.split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/* Cor determinística baseada no nome */
export function corIniciais(nome) {
  if (!nome) return 'initial-1';
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % 8;
  return `initial-${idx + 1}`;
}

/* Máscara de telefone moçambicano (simples) */
export function mascaraTelefone(v) {
  return v.replace(/\D/g, '').slice(0, 12);
}

/* URL de arquivo enviado (usa o proxy /uploads do Vite em dev) */
export function uploadUrl(arquivo) {
  if (!arquivo) return '';
  return arquivo.startsWith('http') ? arquivo : arquivo;
}

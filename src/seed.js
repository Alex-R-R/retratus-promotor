import { DAY, interval } from './domain.js';
const time = value => Date.parse(value + '-03:00');
export const DEMO_PHOTO = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#080b09"/><circle cx="320" cy="140" r="43" fill="none" stroke="#e8c770" stroke-width="6"/><text x="320" y="230" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="24">REGISTRO FICTICIO</text><text x="320" y="265" text-anchor="middle" fill="#e8c770" font-family="sans-serif" font-size="16">Imagem ilustrativa da demonstracao</text></svg>');
export function createSeed() {
  const people = [
    { id: 'owner', name: 'Conta dona · Demo', role: 'owner', phone: '00000000001' },
    { id: 'owner2', name: 'Conta dono · Demo', role: 'owner', phone: '00000000002' },
    { id: 'manager', name: 'Gestão 01 · Demo', role: 'manager', phone: '00000000003' },
    { id: 'manager2', name: 'Gestão 02 · Demo', role: 'manager', phone: '00000000004' },
    { id: 'media', name: 'Mídia · Demo', role: 'media', phone: '00000000005' },
    ...Array.from({ length: 16 }, (_, i) => ({ id: `p${i + 1}`, name: `Promotor ${String(i + 1).padStart(2, '0')} · Demo`, role: 'promoter', phone: `000000001${String(i + 1).padStart(2, '0')}`, link: 'freelancer' })),
    { id: 'employee', name: 'Funcionário 01 · Demo', role: 'promoter', phone: '00000000201', link: 'employee' },
    { id: 'provider', name: 'Prestador 01 · Demo', role: 'promoter', phone: '00000000202', link: 'provider' },
    { id: 'pending', name: 'Novo cadastro · Demo', role: 'promoter', phone: '00000000301', approved: false, link: 'unclassified' }
  ].map(p => ({ approved: true, password: 'demo123', ...p }));
  const day = (id, date, start, end) => ({ id, date, start, end });
  const event = (id, title, location, city, days, services, extra = {}) => ({ id, title, location, city, days, services: services.map(([name, capacity]) => ({ name, capacity })), type: 'event', status: 'published', notes: 'Trabalho fictício para validação. Nenhuma escala real.', preference: '', ...extra });
  const events = [
    event('e1', 'Encontro à beira-rio', 'Espaço Guajará · fictício', 'Belém', [day('e1d', '2026-11-18', '18:00', '22:00')], [['Totem', 2], ['Plataforma 360', 1]], { preference: 'Cliente fictício sinalizou preferência pelo Promotor 01.' }),
    event('e2', 'Conexões Belém', 'Centro de convenções · fictício', 'Belém', [day('e2d', '2026-11-18', '19:00', '23:00')], [['Self print', 2]]),
    event('e3', 'Celebração sob as estrelas', 'Salão das Mangueiras · fictício', 'Ananindeua', [day('e3d', '2026-11-20', '22:00', '02:00')], [['Totem slim', 1], ['Túnel de LED', 1]]),
    event('e4', 'Natal em movimento', 'Praça das luzes · fictícia', 'Belém', Array.from({ length: 40 }, (_, i) => day(`e4d${i}`, new Date(time('2026-11-15T12:00:00') + i * DAY).toISOString().slice(0, 10), '16:00', '20:00')), [['Máquina de garra', 1], ['Totem', 1]], { type: 'action', notes: 'Ação fictícia de 15/11 a 24/12. Ocupação somente das 16h às 20h de cada dia. Substituição registrada em 19/11.' }),
    event('e5', 'Circuito sul do Pará', 'Pavilhão regional · fictício', 'Marabá', Array.from({ length: 5 }, (_, i) => day(`e5d${i}`, `2026-11-${21 + i}`, '09:00', '13:00')), [['Plataforma 360', 2]], { type: 'action' }),
    event('e6', 'Manhã criativa', 'Espaço cultural · fictício', 'Belém', [day('e6d', '2026-11-22', '09:00', '12:00')], [['Totem', 1], ['Self print', 1]]),
    event('e7', 'Recepção das mangueiras', 'Salão central · fictício', 'Belém', [day('e7d', '2026-11-16', '18:00', '22:00')], [['Totem', 2]]),
    event('e8', 'Encontro cancelado', 'Espaço de festas · fictício', 'Belém', [day('e8d', '2026-11-17', '18:00', '21:00')], [['Totem slim', 1]], { status: 'cancelled', cancelReason: 'Cancelamento fictício solicitado pelo contratante.' }),
    event('e9', 'Ação de lançamento', 'Galeria · fictícia', 'Castanhal', [day('e9d', '2026-11-25', '14:00', '18:00')], [['Túnel de LED', 1]], { status: 'draft' })
  ];
  const assignment = (id, eventId, personId, service, dayIds, status = 'confirmed', extra = {}) => ({ id, eventId, personId, service, dayIds, status, invitedAt: time('2026-11-17T12:00:00'), deadline: time('2026-11-18T12:00:00'), ...extra });
  const assignments = [
    assignment('a1', 'e1', 'p1', 'Totem', ['e1d']), assignment('a2', 'e1', 'p2', 'Totem', ['e1d'], 'invited', { invitedAt: time('2026-11-18T10:00:00') }),
    assignment('a3', 'e1', 'p3', 'Plataforma 360', ['e1d'], 'expired', { invitedAt: time('2026-11-18T07:00:00'), deadline: time('2026-11-18T09:00:00') }),
    assignment('a4', 'e2', 'p4', 'Self print', ['e2d']),
    assignment('a5', 'e2', 'p2', 'Self print', ['e2d'], 'invited', { invitedAt: time('2026-11-18T10:00:00') }),
    assignment('a6', 'e3', 'p6', 'Totem slim', ['e3d']),
    assignment('a7', 'e4', 'p7', 'Máquina de garra', events[3].days.filter(d => d.date !== '2026-11-19').map(d => d.id)),
    assignment('a8', 'e4', 'p8', 'Máquina de garra', ['e4d4']),
    assignment('a9', 'e4', 'employee', 'Totem', events[3].days.map(d => d.id)),
    assignment('a10', 'e5', 'p9', 'Plataforma 360', events[4].days.map(d => d.id), 'invited'),
    assignment('a11', 'e7', 'p1', 'Totem', ['e7d']), assignment('a12', 'e7', 'p5', 'Totem', ['e7d']),
    assignment('a13', 'e8', 'p10', 'Totem slim', ['e8d'])
  ];
  const photo = sentAt => ({ name: 'registro-ficticio.svg', size: 500, data: DEMO_PHOTO, sentAt });
  const record = (id, assignmentId, dayId, date, start, end, reviewed, amount) => ({ id, assignmentId, dayId, planned: interval({ date, start, end }), startPhoto: photo(time(`${date}T${start}:00`)), endPhoto: photo(time(`${date}T${end}:00`)), closedAt: time(`${date}T${end}:00`), endedAt: time(`${date}T${end}:00`), review: reviewed ? 'reviewed' : 'pending', validatedStart: reviewed ? time(`${date}T${start}:00`) : null, validatedEnd: reviewed ? time(`${date}T${end}:00`) : null, amount, reviewNote: reviewed ? 'Conferência fictícia de horários.' : '' });
  return { version: 1, now: time('2026-11-18T10:00:00'), people, events, assignments,
    applications: [{ id: 'c1', personId: 'p11', eventId: 'e3', services: ['Totem slim', 'Túnel de LED'], at: time('2026-11-17T10:00:00') }, { id: 'c2', personId: 'p12', eventId: 'e6', services: ['Totem'], at: time('2026-11-17T11:00:00') }, { id: 'c3', personId: 'p3', eventId: 'e1', services: ['Plataforma 360'], at: time('2026-11-16T10:00:00') }],
    records: [record('r1', 'a11', 'e7d', '2026-11-16', '18:00', '22:00', true, 180), record('r2', 'a12', 'e7d', '2026-11-16', '18:00', '22:00', false, null), record('r3', 'a7', 'e4d2', '2026-11-17', '16:00', '20:00', true, 160), record('r4', 'a9', 'e4d2', '2026-11-17', '16:00', '20:00', true, null)],
    history: [{ id: 'h1', at: time('2026-11-18T09:00:00'), by: 'Sistema demonstrativo', message: 'Convocação de Promotor 03 expirada; vaga liberada, sem seleção automática.' }, { id: 'h2', at: time('2026-11-17T15:00:00'), by: 'Gestão 01 · Demo', message: 'Substituição no Natal em movimento em 19/11: Promotor 08 assumiu o dia de Promotor 07. Motivo fictício: indisponibilidade informada.' }],
    eventHistory: [], recordHistory: [], assignmentHistory: [{ ...assignments[6], dayIds: ['e4d4'], removedDays: ['e4d4'], changedAt: time('2026-11-17T15:00:00'), reason: 'Substituição fictícia por indisponibilidade informada.' }] };
}

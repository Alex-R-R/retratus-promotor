export const POLICY = Object.freeze({ zone: 'America/Belem', offset: '-03:00', weekStartsOn: 1, calendarMonth: true, applicationHours: 24, confirmationHours: 24, urgentBeforeHours: 48, urgentHours: 2, retentionDays: 30, photoBytes: 1024 * 1024 });
export const SERVICES = ['Totem', 'Self print', 'Totem slim', 'Plataforma 360', 'Túnel de LED', 'Máquina de garra'];
export const ACTIVITY_TYPES = Object.freeze({ event: 'Evento', action: 'Ação' });
export const HOUR = 3600000;
export const DAY = HOUR * 24;
export const OPERATORS = ['owner', 'manager'];
export function requireRole(actor, roles) { if (!actor || !actor.approved || !roles.includes(actor.role)) throw Error('Este perfil não tem permissão para esta operação.'); }
export function localDate(ms) { return new Intl.DateTimeFormat('en-CA', { timeZone: POLICY.zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms); }
export function interval(day) {
  const start = Date.parse(`${day.date}T${day.start}:00${POLICY.offset}`);
  let end = Date.parse(`${day.date}T${day.end}:00${POLICY.offset}`);
  if (end <= start) end += DAY;
  return { start, end };
}
export function overlaps(a, b) { return a.start < b.end && b.start < a.end; }
export function eventStart(event) { return Math.min(...event.days.map(d => interval(d).start)); }
export function deadline(now, start) { return Math.min(start, now + (start - now < POLICY.urgentBeforeHours * HOUR ? POLICY.urgentHours : POLICY.confirmationHours) * HOUR); }
export function uid(prefix) { return `${prefix}-${globalThis.crypto.randomUUID()}`; }
export function log(state, actor, message) { state.history.unshift({ id: uid('log'), at: state.now, by: actor?.name || 'Sistema demonstrativo', message }); }
export function getEvent(state, id) { const event = state.events.find(e => e.id === id); if (!event) throw Error('Trabalho não encontrado.'); return event; }
export function getAssignment(state, id) { const a = state.assignments.find(a => a.id === id); if (!a) throw Error('Participação não encontrada.'); return a; }
export function active(state, assignment) {
  return getEvent(state, assignment.eventId).status === 'published' && (assignment.status === 'confirmed' || (assignment.status === 'invited' && assignment.deadline > state.now));
}
export function assignmentDays(state, a) { return getEvent(state, a.eventId).days.filter(d => a.dayIds.includes(d.id)); }
export function conflicts(state, personId, days, ignoreId) {
  return state.assignments.filter(a => a.id !== ignoreId && a.personId === personId && a.status === 'confirmed' && getEvent(state, a.eventId).status === 'published' && assignmentDays(state, a).some(d => days.some(other => overlaps(interval(d), interval(other)))));
}
export function expire(state) {
  for (const a of state.assignments) if (a.status === 'invited' && a.deadline <= state.now) { a.status = 'expired'; log(state, null, `Convocação ${a.id} expirada; vaga liberada sem seleção automática.`); }
  for (const record of state.records) {
    if (record.closedAt && state.now >= record.closedAt + POLICY.retentionDays * DAY) {
      for (const key of ['startPhoto', 'endPhoto']) if (record[key]?.data) { record[key].data = null; record[key].deletedAt = state.now; }
    }
  }
  return state;
}
export function freeSlots(state, event, service, dayId, ignoreId) {
  const slot = event.services.find(s => s.name === service);
  return (slot?.capacity || 0) - state.assignments.filter(a => a.id !== ignoreId && a.eventId === event.id && a.service === service && a.dayIds.includes(dayId) && active(state, a)).length;
}
export function apply(state, actor, eventId, services) {
  requireRole(actor, ['promoter']); expire(state);
  const event = getEvent(state, eventId);
  if (event.status !== 'published') throw Error('Oportunidade indisponível.');
  if (state.now >= eventStart(event) - POLICY.applicationHours * HOUR) throw Error('Candidaturas encerradas 24 horas antes do início.');
  if (!services.length || services.some(s => !event.services.some(v => v.name === s))) throw Error('Selecione serviços válidos.');
  if (conflicts(state, actor.id, event.days).length) throw Error('Existe uma escala confirmada sobreposta a este trabalho.');
  const previous = state.applications.find(a => a.personId === actor.id && a.eventId === eventId);
  if (previous && services.some(s => previous.services.includes(s))) throw Error('Você já se candidatou a um dos serviços selecionados.');
  if (previous) previous.services.push(...new Set(services));
  else state.applications.push({ id: uid('application'), personId: actor.id, eventId, services: [...new Set(services)], at: state.now });
  log(state, actor, `Candidatura em ${event.title}: ${services.join(', ')}.`);
}
export function invite(state, actor, { eventId, personId, service, dayIds, reason = '' }) {
  requireRole(actor, OPERATORS); expire(state);
  const event = getEvent(state, eventId);
  const person = state.people.find(p => p.id === personId && p.approved && p.role === 'promoter');
  if (!person || event.status !== 'published' || !event.services.some(s => s.name === service)) throw Error('Pessoa, serviço ou trabalho indisponível.');
  const days = event.days.filter(d => dayIds.includes(d.id));
  if (!days.length || days.length !== new Set(dayIds).size) throw Error('Escolha dias válidos.');
  const start = Math.min(...days.map(d => interval(d).start));
  if (start <= state.now) throw Error('Não é possível convocar após o início da participação.');
  if (conflicts(state, personId, days).length) throw Error('Conflito com uma participação confirmada.');
  if (state.assignments.some(a => a.personId === personId && a.eventId === eventId && active(state, a) && assignmentDays(state, a).some(d => days.some(o => overlaps(interval(d), interval(o)))))) throw Error('A pessoa já ocupa uma vaga incompatível neste trabalho.');
  if (days.some(d => freeSlots(state, event, service, d.id) <= 0)) throw Error('Não há vaga livre em um dos dias selecionados.');
  const a = { id: uid('assignment'), eventId, personId, service, dayIds: days.map(d => d.id), status: 'invited', invitedAt: state.now, deadline: deadline(state.now, start), reason };
  state.assignments.push(a); log(state, actor, `Convocação de ${person.name} para ${event.title} · ${service}. ${reason}`); return a;
}
export function respond(state, actor, id, accept) {
  requireRole(actor, ['promoter']); expire(state);
  const a = getAssignment(state, id);
  if (a.personId !== actor.id) throw Error('Você só pode responder suas próprias convocações.');
  if (a.status !== 'invited' || a.deadline <= state.now) throw Error('Convocação encerrada ou expirada.');
  if (accept) {
    const event = getEvent(state, a.eventId), days = assignmentDays(state, a);
    if (event.status !== 'published' || days.some(d => interval(d).start <= state.now)) throw Error('Trabalho indisponível ou já iniciado.');
    if (conflicts(state, actor.id, days, id).length) throw Error('Conflito de horário: outra participação foi confirmada.');
    if (days.some(d => freeSlots(state, event, a.service, d.id, id) <= 0)) throw Error('Capacidade esgotada.');
  }
  a.status = accept ? 'confirmed' : 'declined'; log(state, actor, `${accept ? 'Confirmou' : 'Recusou'} ${getEvent(state, a.eventId).title}, sem penalização.`);
}
export function release(state, actor, id, dayIds, reason) {
  requireRole(actor, OPERATORS); const a = getAssignment(state, id);
  if (!reason.trim()) throw Error('Registre o motivo da alteração.');
  const removed = a.dayIds.filter(id => dayIds.includes(id));
  if (!removed.length) throw Error('Selecione pelo menos um dia da participação.');
  if (state.records.some(r => r.assignmentId === id && removed.includes(r.dayId))) throw Error('Não remova dias com registros de execução; preserve e confira o histórico.');
  state.assignmentHistory.push({ ...structuredClone(a), changedAt: state.now, reason, removedDays: removed });
  a.dayIds = a.dayIds.filter(id => !removed.includes(id));
  if (!a.dayIds.length) a.status = 'replaced';
  log(state, actor, `Dias removidos da participação de ${state.people.find(p => p.id === a.personId).name}: ${removed.join(', ')}. ${reason}. Nova seleção é manual.`);
}
export function validateEvent(input) {
  if (!input.title.trim() || !input.location.trim() || !input.city.trim()) throw Error('Preencha nome, local e município.');
  if (!['event', 'action'].includes(input.type) || !input.days.length || (input.type === 'event' && input.days.length !== 1)) throw Error('Informe os dias do trabalho corretamente.');
  if (new Set(input.days.map(d => d.date)).size !== input.days.length || new Set(input.days.map(d => d.id)).size !== input.days.length) throw Error('Informe somente um horário diário por data e identificadores únicos.');
  for (const d of input.days) if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.end) || !Number.isFinite(interval(d).start) || localDate(interval(d).start) !== d.date || d.start === d.end) throw Error('Data ou horário inválido.');
  if (input.days.some((d, i) => input.days.slice(i + 1).some(other => overlaps(interval(d), interval(other))))) throw Error('Os horários diários não podem se sobrepor.');
  if (!input.services.length || new Set(input.services.map(s => s.name)).size !== input.services.length || input.services.some(s => !SERVICES.includes(s.name) || !Number.isInteger(s.capacity) || s.capacity < 1 || s.capacity > 30)) throw Error('Informe serviços e capacidades entre 1 e 30.');
}
export function saveEvent(state, actor, input, id) {
  requireRole(actor, OPERATORS); expire(state); validateEvent(input);
  if (!id) {
    if (eventStart(input) <= state.now) throw Error('Cadastre um trabalho futuro.');
    const event = { ...input, id: uid('event'), status: 'draft' }; state.events.push(event); log(state, actor, `Rascunho criado: ${event.title}.`); return event;
  }
  const event = getEvent(state, id);
  if (event.status === 'cancelled') throw Error('Trabalho cancelado não pode ser alterado.');
  const changed = event.type !== input.type || JSON.stringify(event.days) !== JSON.stringify(input.days) || JSON.stringify(event.services) !== JSON.stringify(input.services);
  const records = state.records.filter(r => getAssignment(state, r.assignmentId).eventId === id);
  const immutableDays = event.days.filter(d => interval(d).start <= state.now || records.some(r => r.dayId === d.id));
  if (changed && (immutableDays.some(d => JSON.stringify(d) !== JSON.stringify(input.days.find(other => other.id === d.id))) || (records.length && event.type !== input.type))) throw Error('Preserve os dias já iniciados e o tipo de trabalho com registros. Edite apenas a programação futura.');
  if (changed && input.days.some(d => !immutableDays.some(old => old.id === d.id) && interval(d).start <= state.now)) throw Error('Dias novos ou alterados devem começar no futuro.');
  const affected = state.assignments.filter(a => a.eventId === id && active(state, a));
  if (changed) {
    if (!input.changeReason?.trim()) throw Error('Informe o motivo da alteração de escala.');
    state.eventHistory.push({ ...structuredClone(event), changedAt: state.now, reason: input.changeReason });
    for (const a of affected) {
      const future = a.dayIds.filter(dayId => !immutableDays.some(d => d.id === dayId));
      if (!future.length) continue;
      state.assignmentHistory.push({ ...structuredClone(a), changedAt: state.now, reason: input.changeReason });
      const reason = `Programação alterada: ${input.changeReason}. Aguarde nova convocação dos dias futuros.`;
      const kept = a.dayIds.filter(dayId => !future.includes(dayId));
      if (kept.length) { state.assignments.push({ ...structuredClone(a), id: uid('assignment-change'), dayIds: future, status: 'changed', reason }); a.dayIds = kept; }
      else { a.status = 'changed'; a.reason = reason; }
    }
  }
  Object.assign(event, input); log(state, actor, `${event.title} atualizado.${changed ? ' Convocações anteriores retiradas; a gestão deve convocar novamente e os participantes devem reconfirmar.' : ''}`); return event;
}
export function publish(state, actor, id) { requireRole(actor, OPERATORS); const e = getEvent(state, id); if (e.status !== 'draft' || eventStart(e) <= state.now) throw Error('Só é possível publicar rascunhos futuros.'); e.status = 'published'; log(state, actor, `Publicação de ${e.title}.`); }
export function cancelEvent(state, actor, id, reason) { requireRole(actor, OPERATORS); if (!reason.trim()) throw Error('Informe o motivo.'); const e = getEvent(state, id); e.status = 'cancelled'; e.cancelReason = reason; log(state, actor, `Cancelamento de ${e.title}: ${reason}. Sem penalização.`); }
export function uploadPhoto(state, actor, assignmentId, dayId, kind, photo) {
  requireRole(actor, ['promoter']); expire(state);
  const a = getAssignment(state, assignmentId);
  if (a.personId !== actor.id || a.status !== 'confirmed' || getEvent(state, a.eventId).status !== 'published' || !a.dayIds.includes(dayId)) throw Error('Participação indisponível para este perfil.');
  if (!['start', 'end'].includes(kind) || !photo?.data || !/^data:image\/(png|jpeg|webp);base64,/.test(photo.data) || !Number.isFinite(photo.size) || photo.size <= 0 || photo.size > POLICY.photoBytes || photo.data.length > POLICY.photoBytes * 1.4) throw Error('Envie JPG, PNG ou WebP de até 1 MB.');
  const day = assignmentDays(state, a).find(d => d.id === dayId);
  let record = state.records.find(r => r.assignmentId === assignmentId && r.dayId === dayId);
  if (record?.closedAt) throw Error('Participação deste dia já encerrada.');
  if (kind === 'start') {
    if (record) throw Error('Foto de início já registrada.');
    if (localDate(state.now) !== day.date || state.now > interval(day).end) throw Error('Envie o início na data prevista, antes do término.');
    record = { id: uid('record'), assignmentId, dayId, planned: interval(day), startPhoto: { ...photo, sentAt: state.now }, endedAt: null, closedAt: null, review: 'pending', validatedStart: null, validatedEnd: null, amount: null };
    state.records.push(record);
  } else {
    if (!record?.startPhoto) throw Error('Envie primeiro a foto de início.');
    record.endPhoto = { ...photo, sentAt: state.now }; record.endedAt = state.now; record.closedAt = state.now;
  }
  log(state, actor, `Foto de ${kind === 'start' ? 'início' : 'encerramento'} em ${getEvent(state, a.eventId).title}, dia ${day.date}.${kind === 'end' ? ' Apenas esta participação diária foi encerrada; pendente de conferência.' : ''}`);
}
export function reviewRecord(state, actor, id, start, end, note) {
  requireRole(actor, OPERATORS); const r = state.records.find(r => r.id === id);
  if (!r?.closedAt || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end > state.now || !note.trim()) throw Error('Informe horários válidos, até o momento atual, e uma observação de conferência.');
  state.recordHistory.push({ ...structuredClone(r), startPhoto: undefined, endPhoto: undefined, changedAt: state.now });
  r.validatedStart = start; r.validatedEnd = end; r.review = 'reviewed'; r.reviewNote = note; r.reviewedBy = actor.id;
  log(state, actor, `Horários conferidos em ${id}: ${note}. Envios originais preservados.`);
}
export function setAmount(state, actor, id, amount) { requireRole(actor, ['owner']); const r = state.records.find(r => r.id === id); if (!r?.closedAt || (amount !== null && (!Number.isFinite(amount) || amount < 0))) throw Error('Informe um valor válido após o encerramento.'); log(state, actor, `Valor informado atualizado no registro ${id}.`); r.amount = amount; }
export function canReadPhoto(state, actor, record) { return actor?.approved && (['owner', 'manager', 'media'].includes(actor.role) || (actor.role === 'promoter' && getAssignment(state, record.assignmentId).personId === actor.id)); }
export function metrics(state, actor, from, to) {
  requireRole(actor, OPERATORS);
  return state.people.filter(p => p.role === 'promoter' && p.link === 'freelancer' && p.approved).map(p => {
    const records = state.records.filter(r => { const a = getAssignment(state, r.assignmentId), e = getEvent(state, a.eventId); return a.personId === p.id && r.closedAt && e.status !== 'cancelled' && r.planned.start >= from && r.planned.start < to; });
    return { person: p, events: new Set(records.filter(r => getEvent(state, getAssignment(state, r.assignmentId).eventId).type === 'event').map(r => getAssignment(state, r.assignmentId).eventId)).size,
      days: records.filter(r => getEvent(state, getAssignment(state, r.assignmentId).eventId).type === 'action').length,
      hours: records.filter(r => r.review === 'reviewed').reduce((n, r) => n + (r.validatedEnd - r.validatedStart) / HOUR, 0), pending: records.filter(r => r.review !== 'reviewed').length,
      ...(actor.role === 'owner' ? { amount: records.some(r => r.amount !== null) ? records.reduce((n, r) => n + (r.amount ?? 0), 0) : null, missing: records.filter(r => r.amount === null).length } : {}) };
  });
}
export function register(state, { name, phone, password }) {
  if (!name.trim() || !/^\d{10,11}$/.test(phone) || password.length < 6) throw Error('Informe nome, telefone com DDD (10–11 dígitos) e senha com pelo menos 6 caracteres.');
  if (state.people.some(p => p.phone === phone)) throw Error('Telefone já cadastrado.');
  state.people.push({ id: uid('person'), name: name.trim(), phone, password, role: 'promoter', approved: false, link: 'unclassified' });
  log(state, null, 'Novo cadastro demonstrativo aguardando aprovação dos donos.');
}
export function managePerson(state, actor, id, action, value) {
  const p = state.people.find(p => p.id === id); if (!p) throw Error('Pessoa não encontrada.');
  requireRole(actor, action === 'approve' ? ['owner'] : OPERATORS);
  if (action === 'approve') p.approved = true;
  else if (action === 'link' && ['freelancer', 'employee', 'provider'].includes(value)) p.link = value;
  else if (action === 'password' && value.length >= 6) p.password = value;
  else throw Error('Alteração inválida.');
  log(state, actor, `Cadastro de ${p.name} atualizado: ${action === 'approve' ? 'aprovação' : action === 'link' ? 'vínculo interno' : 'recuperação de acesso'}.`);
}

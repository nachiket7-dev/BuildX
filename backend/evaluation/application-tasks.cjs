// Vertical-slice application tasks. Acceptance is withheld from the agent.
const pkg = '{"type":"module","scripts":{"test":"node --test acceptance.test.mjs"}}';
const task = (id, prompt, files, acceptance, reference, split = 'development') => ({
  id, category: 'application', split, prompt,
  files: { 'package.json': pkg, ...files },
  acceptance: "import assert from 'node:assert/strict';\n" + acceptance,
  reference,
});

module.exports = [
  task('application-reservations',
    'Repair the booking vertical slice. A signed-in user can reserve an available room and list only their own reservations. Derive ownership from the session, enforce room capacity, reject unknown rooms and unauthenticated requests, and keep the client contract working.', {
      'store.mjs': `export const inventory = new Map([['room-a', 2], ['room-b', 1]]);
export const reservations = [];
export function insertReservation(record) {
  const saved = { id: String(reservations.length + 1), ...record };
  reservations.push(saved);
  return saved;
}`,
      'api.mjs': `import { insertReservation, reservations } from './store.mjs';
export async function createReservation(session, input) {
  return insertReservation({ roomId: input.roomId, userId: input.userId });
}
export function listReservations(session) { return reservations; }`,
      'client.mjs': `import { createReservation, listReservations } from './api.mjs';
export function createBookingClient(session) {
  return { reserve: roomId => createReservation(session, { roomId, userId: session?.userId }), mine: () => listReservations(session) };
}`,
    }, `import { createReservation, listReservations } from './api.mjs';
import { createBookingClient } from './client.mjs';
import { reservations } from './store.mjs';
await assert.rejects(createReservation(null, {roomId:'room-a'}));
const alice = createBookingClient({userId:'alice'});
const bob = createBookingClient({userId:'bob'});
const first = await alice.reserve('room-a');
assert.equal(first.userId, 'alice');
const second = await createReservation({userId:'bob'}, {roomId:'room-a', userId:'alice'});
assert.equal(second.userId, 'bob');
await assert.rejects(alice.reserve('room-a'));
await assert.rejects(bob.reserve('missing'));
assert.deepEqual(alice.mine().map(row => row.id), [first.id]);
assert.deepEqual(bob.mine().map(row => row.id), [second.id]);
assert.equal(reservations.length, 2);
assert.throws(() => listReservations(null));`, {
      'store.mjs': `export const inventory = new Map([['room-a', 2], ['room-b', 1]]);
export const reservations = [];
export function insertReservation(userId, roomId) {
  const capacity = inventory.get(roomId);
  if (!capacity) throw new Error('Unknown room');
  if (reservations.filter(row => row.roomId === roomId).length >= capacity) throw new Error('Room full');
  const saved = { id: String(reservations.length + 1), roomId, userId };
  reservations.push(saved);
  return saved;
}
export function reservationsFor(userId) { return reservations.filter(row => row.userId === userId); }`,
      'api.mjs': `import { insertReservation, reservationsFor } from './store.mjs';
function owner(session) { if (!session?.userId) throw new Error('Unauthenticated'); return session.userId; }
export async function createReservation(session, input) {
  const userId = owner(session);
  if (typeof input?.roomId !== 'string') throw new Error('Invalid room');
  return insertReservation(userId, input.roomId);
}
export function listReservations(session) { return reservationsFor(owner(session)); }`,
      'client.mjs': `import { createReservation, listReservations } from './api.mjs';
export function createBookingClient(session) {
  return { reserve: roomId => createReservation(session, { roomId }), mine: () => listReservations(session) };
}`,
    }),

  task('application-checkout',
    'Repair checkout across client, API and store. Orders must use the signed-in owner, validate quantities and stock before mutation, process an idempotency key once per user, and show each user only their own history.', {
      'store.mjs': `export const stock = { sku1: 2, sku2: 1 };
export const orders = [];
export function insertOrder(userId, items, key) {
  for (const item of items) stock[item.sku] -= item.qty;
  const order = { id: String(orders.length + 1), userId, items, key };
  orders.push(order);
  return order;
}
export function ordersFor(userId) { return orders; }`,
      'api.mjs': `import { insertOrder, ordersFor } from './store.mjs';
export function placeOrder(session, request) { return insertOrder(request.userId, request.items, request.idempotencyKey); }
export function getOrders(session) { return ordersFor(session?.userId); }`,
      'client.mjs': `import { placeOrder, getOrders } from './api.mjs';
export function createCheckout(session) {
  return { submit: (items, key) => placeOrder(session, { items, idempotencyKey: key, userId: session?.userId }), history: () => getOrders(session) };
}`,
    }, `import { placeOrder, getOrders } from './api.mjs';
import { createCheckout } from './client.mjs';
import { stock, orders } from './store.mjs';
assert.throws(() => placeOrder(null, {items:[{sku:'sku1',qty:1}],idempotencyKey:'x'}));
const alice = createCheckout({userId:'alice'});
const first = alice.submit([{sku:'sku1',qty:1}], 'request-1');
assert.equal(first.userId, 'alice');
assert.equal(alice.submit([{sku:'sku1',qty:1}], 'request-1').id, first.id);
assert.equal(stock.sku1, 1);
const bob = createCheckout({userId:'bob'});
const second = placeOrder({userId:'bob'}, {items:[{sku:'sku1',qty:1}],idempotencyKey:'request-1',userId:'alice'});
assert.equal(second.userId, 'bob');
assert.equal(stock.sku1, 0);
assert.deepEqual(alice.history().map(order => order.id), [first.id]);
assert.deepEqual(bob.history().map(order => order.id), [second.id]);
assert.throws(() => bob.submit([{sku:'sku1',qty:1}], 'request-2'));
assert.throws(() => bob.submit([{sku:'sku2',qty:-1}], 'request-3'));
assert.deepEqual(stock, {sku1:0,sku2:1});
assert.equal(orders.length, 2);
assert.throws(() => getOrders(null));`, {
      'store.mjs': `export const stock = { sku1: 2, sku2: 1 };
export const orders = [];
export function insertOrder(userId, items, key) {
  const existing = orders.find(order => order.userId === userId && order.key === key);
  if (existing) return existing;
  if (!Array.isArray(items) || !items.length) throw new Error('Empty order');
  const requested = new Map();
  for (const item of items) {
    if (!Object.hasOwn(stock, item.sku) || !Number.isInteger(item.qty) || item.qty <= 0) throw new Error('Invalid item');
    requested.set(item.sku, (requested.get(item.sku) || 0) + item.qty);
  }
  for (const [sku, qty] of requested) if (stock[sku] < qty) throw new Error('Out of stock');
  for (const [sku, qty] of requested) stock[sku] -= qty;
  const order = { id: String(orders.length + 1), userId, items: items.map(item => ({sku:item.sku,qty:item.qty})), key };
  orders.push(order);
  return order;
}
export function ordersFor(userId) { return orders.filter(order => order.userId === userId); }`,
      'api.mjs': `import { insertOrder, ordersFor } from './store.mjs';
function owner(session) { if (!session?.userId) throw new Error('Unauthenticated'); return session.userId; }
export function placeOrder(session, request) {
  const userId = owner(session);
  if (typeof request?.idempotencyKey !== 'string' || !request.idempotencyKey) throw new Error('Missing request key');
  return insertOrder(userId, request.items, request.idempotencyKey);
}
export function getOrders(session) { return ordersFor(owner(session)); }`,
      'client.mjs': `import { placeOrder, getOrders } from './api.mjs';
export function createCheckout(session) {
  return { submit: (items, key) => placeOrder(session, { items, idempotencyKey: key }), history: () => getOrders(session) };
}`,
    }),

  task('application-board-revisions',
    'Repair the board workflow. Only its owner may read or rename tasks. Renames require the current version, update title only, increment the version once, and must never let a client change task identity or board ownership.', {
      'store.mjs': `export const boards = [{id:'board-a',owner:'alice'},{id:'board-b',owner:'bob'}];
export const tasks = [{id:'task-a',boardId:'board-a',title:'Old',version:1},{id:'task-b',boardId:'board-b',title:'Other',version:1}];
export function listTasks(boardId) { return tasks; }
export function updateTask(boardId, id, patch, expectedVersion) {
  const task = tasks.find(item => item.id === id);
  Object.assign(task, patch);
  task.version++;
  return task;
}`,
      'api.mjs': `import { listTasks, updateTask } from './store.mjs';
export function getBoardTasks(session, boardId) { return listTasks(boardId); }
export function renameTask(session, boardId, taskId, patch, version) { return updateTask(boardId, taskId, patch, version); }`,
      'client.mjs': `import { getBoardTasks, renameTask } from './api.mjs';
export function boardClient(session, boardId) {
  return { tasks: () => getBoardTasks(session, boardId), rename: (id, patch, version) => renameTask(session, boardId, id, patch, version) };
}`,
    }, `import { getBoardTasks, renameTask } from './api.mjs';
import { boardClient } from './client.mjs';
import { tasks } from './store.mjs';
const alice = boardClient({userId:'alice'}, 'board-a');
assert.deepEqual(alice.tasks().map(task => task.id), ['task-a']);
assert.throws(() => getBoardTasks({userId:'bob'}, 'board-a'));
assert.throws(() => getBoardTasks(null, 'board-a'));
assert.throws(() => renameTask({userId:'bob'}, 'board-a', 'task-a', {title:'Stolen'}, 1));
assert.throws(() => alice.rename('task-a', {title:'Stale'}, 0));
const changed = alice.rename('task-a', {title:'New',id:'fake',boardId:'board-b',version:99}, 1);
assert.deepEqual(changed, {id:'task-a',boardId:'board-a',title:'New',version:2});
assert.throws(() => alice.rename('task-a', {title:'Again'}, 1));
assert.throws(() => alice.rename('task-b', {title:'Cross-board'}, 1));
assert.equal(tasks.find(task => task.id === 'task-b').title, 'Other');`, {
      'store.mjs': `export const boards = [{id:'board-a',owner:'alice'},{id:'board-b',owner:'bob'}];
export const tasks = [{id:'task-a',boardId:'board-a',title:'Old',version:1},{id:'task-b',boardId:'board-b',title:'Other',version:1}];
export function ownedBoard(boardId, userId) {
  if (!boards.some(board => board.id === boardId && board.owner === userId)) throw new Error('Board unavailable');
}
export function listTasks(boardId) { return tasks.filter(task => task.boardId === boardId); }
export function updateTask(boardId, id, patch, expectedVersion) {
  const task = tasks.find(item => item.id === id && item.boardId === boardId);
  if (!task) throw new Error('Task unavailable');
  if (task.version !== expectedVersion) throw new Error('Stale version');
  if (typeof patch?.title !== 'string' || !patch.title.trim()) throw new Error('Invalid title');
  task.title = patch.title;
  task.version++;
  return task;
}`,
      'api.mjs': `import { ownedBoard, listTasks, updateTask } from './store.mjs';
function authorize(session, boardId) { if (!session?.userId) throw new Error('Unauthenticated'); ownedBoard(boardId, session.userId); }
export function getBoardTasks(session, boardId) { authorize(session, boardId); return listTasks(boardId); }
export function renameTask(session, boardId, taskId, patch, version) { authorize(session, boardId); return updateTask(boardId, taskId, patch, version); }`,
      'client.mjs': `import { getBoardTasks, renameTask } from './api.mjs';
export function boardClient(session, boardId) {
  return { tasks: () => getBoardTasks(session, boardId), rename: (id, patch, version) => renameTask(session, boardId, id, patch, version) };
}`,
    }, 'held-out'),

  task('application-team-invites',
    'Repair team invitations across client, API and store. Only the team admin can create an invitation; only the signed-in account with the invited email can accept it once. Members may view their team, and other users must not see its membership.', {
      'store.mjs': `export const teams = [{id:'team-a',admin:'alice',members:['alice']},{id:'team-b',admin:'bob',members:['bob']}];
export const invites = [];
export function createInvite(teamId, email) {
  const row = {token:'invite-' + (invites.length + 1),teamId,email};
  invites.push(row);
  return row;
}
export function acceptInvite(token, userId) {
  const invite = invites.find(row => row.token === token);
  teams.find(team => team.id === invite.teamId).members.push(userId);
  return invite.teamId;
}
export function members(teamId) { return teams.find(team => team.id === teamId).members; }`,
      'api.mjs': `import {createInvite,acceptInvite,members} from './store.mjs';
export function inviteMember(session,teamId,email) { return createInvite(teamId,email); }
export function joinTeam(session,token) { return acceptInvite(token,session?.userId); }
export function listMembers(session,teamId) { return members(teamId); }`,
      'client.mjs': `import {inviteMember,joinTeam,listMembers} from './api.mjs';
export function teamClient(session,teamId) {
  return {invite:email=>inviteMember(session,teamId,email),join:token=>joinTeam(session,token),members:()=>listMembers(session,teamId)};
}`,
    }, `import {inviteMember,joinTeam,listMembers} from './api.mjs';
import {teamClient} from './client.mjs';
import {teams,invites} from './store.mjs';
const alice=teamClient({userId:'alice',email:'alice@example.test'},'team-a');
assert.throws(()=>inviteMember({userId:'bob',email:'bob@example.test'},'team-a','x@example.test'));
const invite=alice.invite('dev@example.test');
assert.throws(()=>joinTeam({userId:'eve',email:'eve@example.test'},invite.token));
assert.deepEqual(alice.members(),['alice']);
assert.equal(joinTeam({userId:'dev',email:'dev@example.test'},invite.token),'team-a');
assert.deepEqual(alice.members(),['alice','dev']);
assert.throws(()=>joinTeam({userId:'dev',email:'dev@example.test'},invite.token));
assert.throws(()=>listMembers({userId:'bob',email:'bob@example.test'},'team-a'));
assert.throws(()=>listMembers(null,'team-a'));
assert.deepEqual(teams.find(team=>team.id==='team-b').members,['bob']);
assert.equal(invites.length,1);`, {
      'store.mjs': `export const teams = [{id:'team-a',admin:'alice',members:['alice']},{id:'team-b',admin:'bob',members:['bob']}];
export const invites = [];
export function team(teamId) { const found=teams.find(row=>row.id===teamId); if(!found)throw new Error('Team unavailable'); return found; }
export function createInvite(teamId, email) {
  team(teamId);
  const row = {token:'invite-' + (invites.length + 1),teamId,email,used:false};
  invites.push(row);
  return row;
}
export function acceptInvite(token, userId, email) {
  const invite = invites.find(row => row.token === token);
  if (!invite || invite.used || invite.email !== email) throw new Error('Invitation unavailable');
  const target=team(invite.teamId);
  if (!target.members.includes(userId)) target.members.push(userId);
  invite.used=true;
  return target.id;
}
export function members(teamId) { return [...team(teamId).members]; }`,
      'api.mjs': `import {team,createInvite,acceptInvite,members} from './store.mjs';
function identity(session) { if(!session?.userId || !session?.email)throw new Error('Unauthenticated'); return session; }
export function inviteMember(session,teamId,email) {
  const user=identity(session);
  if(team(teamId).admin!==user.userId)throw new Error('Forbidden');
  if(typeof email!=='string' || !email.includes('@'))throw new Error('Invalid email');
  return createInvite(teamId,email);
}
export function joinTeam(session,token) { const user=identity(session); return acceptInvite(token,user.userId,user.email); }
export function listMembers(session,teamId) {
  const user=identity(session);
  if(!team(teamId).members.includes(user.userId))throw new Error('Forbidden');
  return members(teamId);
}`,
      'client.mjs': `import {inviteMember,joinTeam,listMembers} from './api.mjs';
export function teamClient(session,teamId) {
  return {invite:email=>inviteMember(session,teamId,email),join:token=>joinTeam(session,token),members:()=>listMembers(session,teamId)};
}`,
    }, 'held-out'),
];

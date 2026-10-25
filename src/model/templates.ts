import { isKnownKind } from '../content/components.ts';
import {
  Design,
  SIDES,
  type Group,
  type PortRef,
  type Side,
} from './design.ts';

export interface Lesson {
  problem: string;
  why: string[];
  takeaways: string[];
}

export interface TemplateNode {
  id: string;
  kind: string;
  label?: string;
  /** For clients: how many users they stand for. */
  users?: number;
  x: number;
  y: number;
}

/** `from` and `to` are written as "nodeId.side", e.g. "client.right". */
export interface TemplateCable {
  from: string;
  to: string;
  label?: string;
  oneWay?: boolean;
}

export interface Template {
  id: string;
  title: string;
  summary: string;
  lesson: Lesson;
  groups?: Group[];
  nodes: TemplateNode[];
  cables: TemplateCable[];
}

/** Lists every problem in a template; an empty list means it is valid. */
export function validateTemplate(template: Template): string[] {
  const problems: string[] = [];
  const nodeIds = new Set<string>();

  for (const node of template.nodes) {
    if (nodeIds.has(node.id)) problems.push(`Duplicate node id "${node.id}"`);
    nodeIds.add(node.id);
    if (!isKnownKind(node.kind)) {
      problems.push(`Node "${node.id}" has unknown kind "${node.kind}"`);
    }
  }

  const connected = new Set<string>();
  for (const cable of template.cables) {
    const ends = [cable.from, cable.to].map(parseEnd);
    const name = `Cable ${cable.from} → ${cable.to}`;
    for (const end of ends) {
      if (!end) problems.push(`${name} must use "nodeId.side" ends`);
      else if (!nodeIds.has(end.nodeId)) {
        problems.push(`${name} refers to unknown node "${end.nodeId}"`);
      }
    }
    const [from, to] = ends;
    if (!from || !to) continue;
    const pair = [from.nodeId, to.nodeId].sort().join('|');
    if (from.nodeId === to.nodeId) problems.push(`${name} loops to itself`);
    else if (connected.has(pair)) problems.push(`${name} is a duplicate`);
    connected.add(pair);
  }

  return problems;
}

export function loadTemplate(design: Design, template: Template): void {
  const problems = validateTemplate(template);
  if (problems.length > 0) {
    throw new Error(`Template "${template.id}": ${problems.join('; ')}`);
  }

  design.clear();
  design.groups = (template.groups ?? []).map((group) => ({ ...group }));

  const designIds = new Map<string, string>();
  for (const node of template.nodes) {
    const position = { x: node.x, y: node.y };
    const added = design.addNode(node.kind, position, node.label);
    if (node.users !== undefined) design.setUsers(added.id, node.users);
    designIds.set(node.id, added.id);
  }

  const toPort = (end: string): PortRef => {
    const { nodeId, side } = parseEnd(end)!;
    return { nodeId: designIds.get(nodeId)!, side };
  };
  for (const cable of template.cables) {
    design.connect(toPort(cable.from), toPort(cable.to), {
      label: cable.label,
      oneWay: cable.oneWay,
    });
  }
}

/** The board as template JSON, as a starting point for a new template. */
export function toTemplate(design: Design): Template {
  const templateIds = new Map<string, string>();
  const nodes = design.nodes.map((node, index) => {
    const id = `${node.kind}-${index + 1}`;
    templateIds.set(node.id, id);
    const templateNode: TemplateNode = {
      id,
      kind: node.kind,
      x: Math.round(node.x),
      y: Math.round(node.y),
    };
    if (node.label) templateNode.label = node.label;
    if (node.users !== undefined) templateNode.users = node.users;
    return templateNode;
  });

  const toEnd = (port: PortRef) =>
    `${templateIds.get(port.nodeId)}.${port.side}`;
  const cables = design.cables.map((cable) => {
    const templateCable: TemplateCable = {
      from: toEnd(cable.from),
      to: toEnd(cable.to),
    };
    if (cable.label) templateCable.label = cable.label;
    if (cable.oneWay) templateCable.oneWay = true;
    return templateCable;
  });

  return {
    id: 'my-design',
    title: 'My design',
    summary: '',
    lesson: { problem: '', why: [], takeaways: [] },
    groups: design.groups,
    nodes,
    cables,
  };
}

/**
 * Reads a board saved as JSON (as exported, or any template), or explains
 * in plain words why it can't, so a bad file never touches the board.
 */
export function parseBoard(
  text: string,
  title: string,
): { board: Template } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "It isn't valid JSON, so it can't be read." };
  }
  if (!isRecord(data) || !Array.isArray(data.nodes)) {
    return { error: 'It isn\'t a board: a board file has a "nodes" list.' };
  }
  const { nodes, cables = [], groups = [] } = data;
  if (!Array.isArray(cables) || !Array.isArray(groups)) {
    return { error: 'Its "cables" and "groups" must be lists.' };
  }

  const badNode = nodes.findIndex(
    (node) =>
      !isRecord(node) ||
      typeof node.id !== 'string' ||
      typeof node.kind !== 'string' ||
      !isNumber(node.x) ||
      !isNumber(node.y) ||
      !isOptional(node.label, 'string') ||
      !(node.users === undefined || isNumber(node.users)),
  );
  if (badNode >= 0) {
    return {
      error: `Component ${badNode + 1} needs an "id", a "kind" and "x" and "y" numbers.`,
    };
  }
  const badCable = cables.findIndex(
    (cable) =>
      !isRecord(cable) ||
      typeof cable.from !== 'string' ||
      typeof cable.to !== 'string' ||
      !isOptional(cable.label, 'string') ||
      !isOptional(cable.oneWay, 'boolean'),
  );
  if (badCable >= 0) {
    return {
      error: `Cable ${badCable + 1} needs a "from" and a "to", like "client.right".`,
    };
  }
  const badGroup = groups.findIndex(
    (group) =>
      !isRecord(group) ||
      typeof group.label !== 'string' ||
      ![group.x, group.y, group.width, group.height].every(isNumber),
  );
  if (badGroup >= 0) {
    return {
      error: `Group ${badGroup + 1} needs a "label" and "x", "y", "width" and "height" numbers.`,
    };
  }

  const board: Template = {
    id: 'imported',
    title,
    summary: '',
    lesson: { problem: '', why: [], takeaways: [] },
    groups: groups as Group[],
    nodes: nodes as TemplateNode[],
    cables: cables as TemplateCable[],
  };
  const [first, ...more] = validateTemplate(board);
  if (first) {
    const problems = more.length === 1 ? 'problem' : 'problems';
    const others =
      more.length > 0 ? ` (and ${more.length} more ${problems})` : '';
    return { error: `${first}${others}.` };
  }
  return { board };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptional(value: unknown, type: 'string' | 'boolean'): boolean {
  return value === undefined || typeof value === type;
}

function parseEnd(end: string): { nodeId: string; side: Side } | null {
  const separator = end.lastIndexOf('.');
  const nodeId = end.slice(0, separator);
  const side = end.slice(separator + 1) as Side;
  if (separator <= 0 || !SIDES.includes(side)) return null;
  return { nodeId, side };
}

import YError from 'yerror';

export type Node = {
  __name: string;
  __childNodes?: Node[];
};

const MAX_ITERATIONS = 99;

export function buildInitializationSequence(rootNode: Node): string[][] {
  const batches: string[][] = [];
  let i = 0;

  while (i < MAX_ITERATIONS) {
    const batch = recursivelyGetNextSequenceBatch(rootNode, batches);

    if (0 === batch.length) {
      break;
    }
    batches.push(batch);
    i++;
  }

  if (i === MAX_ITERATIONS) {
    throw new YError('E_PROBABLE_CIRCULAR_DEPENDENCY');
  }

  return batches;
}

function recursivelyGetNextSequenceBatch(
  node: Node,
  batches: string[][],
  batch: string[] = [],
): string[] {
  const nodeIsALeaf = !(node.__childNodes && node.__childNodes.length);

  if (nodeIsInBatches(batches, node)) {
    return batch;
  }

  if (
    nodeIsALeaf ||
    (node.__childNodes as Node[]).every((childNode: Node) =>
      nodeIsInBatches(batches, childNode),
    )
  ) {
    return batch.concat(node.__name);
  }

  return (node.__childNodes as Node[]).reduce(
    (batch, childNode) => [
      ...new Set(recursivelyGetNextSequenceBatch(childNode, batches, batch)),
    ],
    batch,
  );
}

function nodeIsInBatches(batches: string[][], node: Node): boolean {
  return batches.some((batch) => batch.includes(node.__name));
}

import YError from 'yerror';

const MAX_ITERATIONS = 99;

export function buildInitializationSequence(rootNode) {
  const batches = [];
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

function recursivelyGetNextSequenceBatch(node, batches, batch = []) {
  const nodeIsALeaf = !(node.__childNodes && node.__childNodes.length);

  if (nodeIsInBatches(batches, node)) {
    return batch;
  }

  if (
    nodeIsALeaf ||
    node.__childNodes.every(nodeIsInBatches.bind(null, batches))
  ) {
    return batch.concat(node.__name);
  }

  return node.__childNodes.reduce(
    (batch, childNode) => [
      ...new Set(recursivelyGetNextSequenceBatch(childNode, batches, batch)),
    ],
    batch,
  );
}

function nodeIsInBatches(batches, node) {
  return batches.some((batch) => batch.includes(node.__name));
}

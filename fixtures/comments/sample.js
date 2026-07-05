// TODO: refactor this function to reduce complexity
function foo() {
  /* FIXME: handle the empty-array edge case */
  return 1;
}

const url = "https://example.com/TODO"; // not a real artifact, but acceptable false positive

/*
 * HACK: this whole block is a workaround
 * for a bug in the upstream library
 */
function bar() {
  return 2;
}

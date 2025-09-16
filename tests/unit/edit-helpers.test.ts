import assert from 'node:assert/strict';
import { autoFormat } from '../../lib/utils/edit-helpers';

function testPreservesSingleNewline() {
  const input = 'First line.\nSecond line.';
  const output = autoFormat(input);

  assert.equal(output, 'First line.\nSecond line.', 'Single newline should be preserved');
}

function testPreservesBlankLine() {
  const input = 'Paragraph one.\n\nParagraph two.';
  const output = autoFormat(input);

  assert.equal(
    output,
    'Paragraph one.\n\nParagraph two.',
    'Blank lines between paragraphs should remain intact',
  );
}

function testStillNormalizesSpacing() {
  const input = 'Hello   world !\nThis  is   spaced .';
  const output = autoFormat(input);

  assert.equal(output, 'Hello world!\nThis is spaced.', 'Spacing should still be normalized');
}

function run() {
  testPreservesSingleNewline();
  testPreservesBlankLine();
  testStillNormalizesSpacing();

  console.log('edit-helpers tests passed');
}

run();

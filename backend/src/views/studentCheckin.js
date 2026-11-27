const htmlEntities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => htmlEntities[character]);

module.exports = function renderStudentCheckin(eventName, { closed, error, receipt } = {}) {
  let content;
  if (closed) {
    content = '<p>Event check-in is closed.</p>';
  } else if (receipt) {
    content = `<p class="success">${receipt.created ? 'Checked in for your session.' : 'You’re already checked in for this session.'}</p>
      <h2>${escapeHtml(receipt.session_title)}</h2>
      <p>${escapeHtml(receipt.venue_name)}</p>
      <a href="">Start another check-in</a>`;
  } else {
    content = `${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
      <form method="post">
        <label for="student-number">Student number</label>
        <input id="student-number" name="student_number" type="text" maxlength="128"
          autocomplete="off" autocapitalize="off" spellcheck="false" required aria-describedby="number-help">
        <p id="number-help">Enter the number you used to pre-register.</p>
        <button type="submit">Check in</button>
      </form>`;
  }
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Student check-in · ${escapeHtml(eventName)}</title>
  <style>
    * { box-sizing: border-box }
    body { margin: 0; background: #f4f7fc; color: #152445; font: 1rem/1.5 system-ui, sans-serif }
    main { width: min(calc(100% - 2rem), 28rem); margin: clamp(2rem, 12vh, 7rem) auto; padding: clamp(1rem, 5vw, 2rem);
      background: #fff; border: 1px solid #d5deed; border-radius: 1rem }
    h1 { margin: 0; font-size: 1.75rem; line-height: 1.2 }
    h2 { margin: 1.25rem 0 0; font-size: 1.125rem }
    p { margin: .5rem 0 1.25rem }
    label { display: block; font-weight: 650; margin-bottom: .4rem }
    input, button { width: 100%; min-height: 3rem; padding: .65rem .75rem; border-radius: .5rem; font: inherit }
    input { border: 1px solid #687a98; color: inherit }
    button { border: 0; background: #184ab5; color: #fff; font-weight: 650; cursor: pointer }
    a { color: #184ab5 }
    :focus-visible { outline: 3px solid #2462dc; outline-offset: 3px }
    .error { color: #982519 }
    .success { color: #146040; font-weight: 650 }
  </style>
</head>
<body>
  <main>
    <h1>Student check-in</h1>
    <p>${escapeHtml(eventName)}</p>
    ${content}
  </main>
</body>
</html>`;
};

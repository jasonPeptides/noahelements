/* Noah Elements — lightweight cookie / storage notice.
 * The site only uses essential first-party storage (language + cart). This is a
 * courtesy notice; the choice is remembered so it shows once. Bilingual.
 */
(function () {
  'use strict';
  var KEY = 'noah_cookie_consent';

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  if (stored()) return; // already decided

  function build() {
    var el = document.createElement('div');
    el.className = 'cookie-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Cookie notice');
    el.innerHTML =
      '<p class="cookie-text">' +
        '<span class="en-only">We use essential cookies and local storage to remember your language and cart. ' +
          'See our <a href="/privacy.html">Privacy Policy</a>.</span>' +
        '<span class="cn-only">我们仅使用必要的 cookie 与本地存储，以记住你的语言与购物车。' +
          '详见<a href="/privacy.html">隐私政策</a>。</span>' +
      '</p>' +
      '<div class="cookie-actions">' +
        '<button class="cookie-btn cookie-decline" type="button">' +
          '<span class="en-only">Decline</span><span class="cn-only">拒绝</span></button>' +
        '<button class="cookie-btn cookie-accept" type="button">' +
          '<span class="en-only">Accept</span><span class="cn-only">接受</span></button>' +
      '</div>';
    document.body.appendChild(el);
    // animate in
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('show'); }); });

    function dismiss(choice) {
      save(choice);
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 600);
    }
    el.querySelector('.cookie-accept').addEventListener('click', function () { dismiss('accepted'); });
    el.querySelector('.cookie-decline').addEventListener('click', function () { dismiss('declined'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();

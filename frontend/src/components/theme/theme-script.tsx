/**
 * Runs before paint to apply the saved theme from the `theme` cookie (falling
 * back to the OS preference for "system"). This prevents a flash of the wrong
 * theme on first load. Kept dependency-free and inline on purpose.
 */
export function ThemeScript() {
  const script = `(function(){try{
    var m=document.cookie.match(/(?:^|; )theme=([^;]+)/);
    var t=m?decodeURIComponent(m[1]):'system';
    var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root=document.documentElement;
    root.classList.toggle('dark',dark);
    root.style.colorScheme=dark?'dark':'light';
  }catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

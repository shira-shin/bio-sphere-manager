export function makeDraggable(elementId) {
  const elm = document.getElementById(elementId);
  if (!elm) return;
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  const header = document.getElementById(`${elementId}-header`);
  const handle = header || elm;
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    const parent = elm.parentElement;
    const maxLeft = Math.max(8, (parent?.clientWidth || window.innerWidth) - elm.offsetWidth - 8);
    const maxTop = Math.max(8, (parent?.clientHeight || window.innerHeight) - elm.offsetHeight - 8);
    const nextLeft = Math.min(Math.max(8, elm.offsetLeft - pos1), maxLeft);
    const nextTop = Math.min(Math.max(8, elm.offsetTop - pos2), maxTop);

    elm.style.left = `${nextLeft}px`;
    elm.style.top = `${nextTop}px`;
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

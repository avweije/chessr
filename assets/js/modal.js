import "../styles/modal.css";

export class Modal {
  /**
   * Register a modal and it's buttons.
   *
   * buttons = an array of objects with settings:
   * - { element: <buttonElement>, action: [open|close|handler], handler: <function> }
   *
   * onClose = a function that will be called before the dialog closes, returning false cancels closing.
   *
   * @static
   * @param {*} modal
   * @param {*} [buttons=[]]
   * @param {*} onClose
   * @memberof Modal
   */
  static register(modal, buttons = [], onClose = null) {
    for (var i = 0; i < buttons.length; i++) {
      switch (buttons[i].action) {
        case "open":
          buttons[i].element.addEventListener("click", () => {
            Modal.open(modal);
          });
          break;
        case "close":
          buttons[i].element.addEventListener("click", () => {
            if (onClose) {
              if (onClose() === false) {
                return;
              }
            }
            Modal.close(modal);
          });
          break;
        case "handler":
          buttons[i].element.addEventListener(
            "click",
            (function (handler) {
              return function () {
                handler();
              };
            })(buttons[i].handler)
          );
          break;
      }
    }
  }

  static open(modal) {
    modal.classList.remove("closing");
    modal.showModal();
    modal.classList.add("showing");
  }

  static close(modal) {
    modal.classList.remove("showing");
    modal.classList.add("closing");
    modal.addEventListener(
      "animationend",
      () => {
        modal.close();
        modal.classList.remove("closing");
      },
      { once: true }
    );
  }
}

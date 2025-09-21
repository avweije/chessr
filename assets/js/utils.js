/**
 * Helper functions, utilities.
 * 
 * - showLoading, hideLoading - keeps track of show count
 * - showError, hideError
 * - getAbbreviatedNumber
 * 
 */
export class Utils {
  // The page loading container
  static pageLoader = null;
  // The Notyf container
  static notyf = null;

  // Overlay show counter
  static showCounter = 0;

  static {
    // Get the elements
    this.pageLoader = document.getElementById("pageLoader");
    // Create an instance of Notyf
    this.notyf = new Notyf({
      duration: 2000,
      position: {
        x: 'right',
        y: 'bottom',
      },
      types: [
        {
          type: 'success',
          className: 'notyf-success-toast',
          icon: {
            className: 'fas fa-check-circle'
          }
        },
        {
          type: 'info',
          className: 'notyf-info-toast',
          icon: {
            className: 'fas fa-info-circle'
          }
        },
        {
          type: 'warning',
          className: 'notify-warning-toast',
          icon: {
            className: 'fas fa-exclamation-triangle'
          }
        },
        {
          type: 'error',
          className: 'notify-error-toast',
          duration: 2500,
          dismissible: true,
          icon: {
            className: 'fas fa-times-circle'
          }
        }
      ]
    });

    console.log('Notyf', this.notyf);
  }

  // Shows a loader
  static showLoading() {
    if (this.showCounter == 0) {
      this.pageLoader && this.pageLoader.classList.remove("is-hidden");
    }

    this.showCounter++;
  }

  // Hides the loader
  static hideLoading(force = false) {
    this.showCounter--;

    if (this.showCounter <= 0 || force) {
      this.pageLoader && this.pageLoader.classList.add("is-hidden");
      this.showCounter = 0;
    }
  }

  // Show a success toast
  static showSuccess(msg) {
    // Get the error object message or just return the original variable
    msg = this.parseErrorMessage(msg);
    // Get the options object
    const opts = this.getNotyfOptions(msg);
    // Display an info notification 
    this.notyf.success(opts);
  }

  // Show an info toast
  static showInfo(msg) {
    // Get the error object message or just return the original variable
    msg = this.parseErrorMessage(msg);
    // Get the options object
    const opts = this.getNotyfOptions(msg, 'info');
    // Display an info notification 
    this.notyf.open(opts);
  }

  // Show an info toast
  static showWarning(msg) {
    // Get the error object message or just return the original variable
    msg = this.parseErrorMessage(msg);
    // Get the options object
    const opts = this.getNotyfOptions(msg, 'info');
    // Display an info notification 
    this.notyf.open(opts);
  }

  // Show an error toast
  static showError(msg) {
    console.log('Utils.showError', msg);
    // Get the error object message or just return the original variable
    msg = this.parseErrorMessage(msg);
    // Get the options object
    const opts = this.getNotyfOptions(msg);
    // Display an error notification 
    this.notyf.error(opts);
  }

  static parseErrorMessage(msg) {
    // Check to see if this is an error object
    if (msg && typeof msg === 'object' && msg.name && typeof msg.name === 'string') {
      return msg.message ?? msg.error ?? '';
    }
    return msg;
  }

  static getNotyfOptions(msg, type) {
    if (msg && typeof msg === 'string') {
      msg = { message: msg };
      if (type) msg.type = type;
    } else if (msg && typeof msg === 'object') {
      if (msg.duration === 'short') msg.duration = 1250;
      if (msg.duration === 'long') msg.duration = 3000;
    }
    return msg;
  }

  // Hide the error icon
  static hideError() {
  }

  // Get a number as B+ (billion), M+ (million) or k+ (thousand)
  static getAbbreviatedNumber(number, abbrev = "") {
    if (isNaN(number)) {
      return "";
    }

    number = Math.abs(number);
    if (number < 100) {
      return number + abbrev;
    } else if (number < 501) {
      return "99" + (abbrev == "" ? "+" : abbrev);
    } else if (number < 1001 || abbrev == "B") {
      return "500" + (abbrev == "" ? "+" : abbrev);
    } else {
      number = Math.floor((number - 1) / 1000);
      return Utils.getAbbreviatedNumber(
        number,
        abbrev == "" ? "k+" : abbrev == "k+" ? "M+" : "B+"
      );
    }
  }

  // Get a human readable duration for a number of seconds (2h 14m 32s)
  static getDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds - h * 3600) / 60);
    const s = Math.floor(seconds - h * 3600 - m * 60);

    return (h > 0 ? h + "h " : "") + (h > 0 || m > 0 ? m + "m " : "") + s + "s";
  }
}
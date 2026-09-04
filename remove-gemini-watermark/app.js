/* EraseOff
 * Browser-only Gemini watermark remover
 */

import {
  removeWatermarkFromImageData
} from "@pilio/gemini-watermark-remover";

(function () {
  "use strict";

  var MAX_BYTES = 25 * 1024 * 1024;

  var TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp"
  ];

  var $ = function (id) {
    return document.getElementById(id);
  };

  var dropzone = $("dropzone");
  var input = $("file-input");
  var errorEl = $("file-error");

  var panels = {
    upload: $("panel-upload"),
    ready: $("panel-ready"),
    processing: $("panel-processing"),
    result: $("panel-result")
  };

  var previewImg = $("preview-img");
  var filenameEl = $("filename");
  var resultImg = $("result-img");
  var downloadLink = $("btn-download");
  var progress = $("progress");
  var progressBar = $("progress-bar");

  var tabBefore = $("tab-before");
  var tabAfter = $("tab-after");

  var state = {
    file: null,
    originalUrl: null,
    resultUrl: null,
    timer: null
  };

  /* ---------------------------------------------
     UI
  --------------------------------------------- */

  function show(name) {
    Object.keys(panels).forEach(function (key) {
      if (panels[key]) {
        panels[key].hidden = key !== name;
      }
    });
  }

  function setError(message) {
    if (!errorEl) {
      return;
    }

    errorEl.textContent = message || "";
    errorEl.hidden = !message;
  }

  function stopProgress() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function revokeUrls() {
    if (state.originalUrl) {
      URL.revokeObjectURL(state.originalUrl);
      state.originalUrl = null;
    }

    if (state.resultUrl) {
      URL.revokeObjectURL(state.resultUrl);
      state.resultUrl = null;
    }
  }

  /* ---------------------------------------------
     Validation
  --------------------------------------------- */

  function validate(file) {
    if (!file) {
      return "Please choose an image.";
    }

    if (TYPES.indexOf(file.type) === -1) {
      return "Unsupported file type. Please choose PNG, JPG or WebP.";
    }

    if (file.size <= 0) {
      return "That file appears to be empty.";
    }

    if (file.size > MAX_BYTES) {
      return "That image is larger than 25 MB.";
    }

    return null;
  }

  function outputName(name) {
    var dot = name.lastIndexOf(".");

    var base =
      dot > 0
        ? name.slice(0, dot)
        : name;

    return base + "-eraseoff.png";
  }

  /* ---------------------------------------------
     Load image
  --------------------------------------------- */

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();

      img.onload = function () {
        URL.revokeObjectURL(url);

        if (
          !img.naturalWidth ||
          !img.naturalHeight
        ) {
          reject(
            new Error(
              "Invalid image dimensions."
            )
          );
          return;
        }

        resolve(img);
      };

      img.onerror = function () {
        URL.revokeObjectURL(url);

        reject(
          new Error(
            "The browser could not decode this image."
          )
        );
      };

      img.src = url;
    });
  }

  /* ---------------------------------------------
     Image -> ImageData
  --------------------------------------------- */

  function getImageData(img) {
    var canvas =
      document.createElement("canvas");

    canvas.width =
      img.naturalWidth;

    canvas.height =
      img.naturalHeight;

    var ctx =
      canvas.getContext(
        "2d",
        {
          willReadFrequently: true
        }
      );

    if (!ctx) {
      throw new Error(
        "Canvas 2D is not available."
      );
    }

    ctx.drawImage(
      img,
      0,
      0,
      img.naturalWidth,
      img.naturalHeight
    );

    return ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
  }

  /* ---------------------------------------------
     Process with REAL package API
     ---------------------------------------------
     The official SDK returns:

       {
         imageData,
         meta
       }

     for removeWatermarkFromImageData().
  --------------------------------------------- */

  async function processImage(file) {
    var img =
      await loadImage(file);

    console.log(
      "EraseOff input:",
      img.naturalWidth,
      "x",
      img.naturalHeight
    );

    var sourceData =
      getImageData(img);

    console.log(
      "EraseOff: starting watermark engine"
    );

    var result =
      await removeWatermarkFromImageData(
        sourceData,
        {
          adaptiveMode: "auto"
        }
      );

    console.log(
      "EraseOff watermark metadata:",
      result.meta
    );

    if (
      !result ||
      !result.imageData
    ) {
      throw new Error(
        "Watermark engine returned no image data."
      );
    }

    return {
      imageData: result.imageData,
      meta: result.meta || null
    };
  }

  /* ---------------------------------------------
     ImageData -> REAL browser canvas
  --------------------------------------------- */

  function imageDataToCanvas(imageData) {
    if (
      !imageData ||
      !imageData.data ||
      !imageData.width ||
      !imageData.height
    ) {
      throw new Error(
        "Invalid processed image data."
      );
    }

    var canvas =
      document.createElement("canvas");

    canvas.width =
      imageData.width;

    canvas.height =
      imageData.height;

    var ctx =
      canvas.getContext("2d");

    if (!ctx) {
      throw new Error(
        "Could not create output canvas."
      );
    }

    /*
     * The package returns ImageDataLike.
     * Convert it into native browser ImageData.
     */
    var nativeImageData =
      new ImageData(
        new Uint8ClampedArray(
          imageData.data
        ),
        imageData.width,
        imageData.height
      );

    ctx.putImageData(
      nativeImageData,
      0,
      0
    );

    return canvas;
  }

  /* ---------------------------------------------
     Canvas -> PNG
  --------------------------------------------- */

  function canvasToBlob(canvas) {
    return new Promise(function (
      resolve,
      reject
    ) {
      /*
       * IMPORTANT:
       * This is now a REAL browser canvas,
       * created with document.createElement().
       *
       * Therefore toBlob() exists.
       */

      if (
        !canvas ||
        typeof canvas.toBlob !== "function"
      ) {
        reject(
          new Error(
            "Browser canvas export is unavailable."
          )
        );

        return;
      }

      canvas.toBlob(
        function (blob) {
          if (!blob) {
            reject(
              new Error(
                "Could not create PNG output."
              )
            );

            return;
          }

          resolve(blob);
        },
        "image/png"
      );
    });
  }

  /* ---------------------------------------------
     Upload
  --------------------------------------------- */

  function accept(file) {
    var error =
      validate(file);

    if (error) {
      setError(error);
      return;
    }

    setError("");

    revokeUrls();

    state.file = file;

    state.originalUrl =
      URL.createObjectURL(file);

    previewImg.src =
      state.originalUrl;

    previewImg.alt =
      "Preview of " +
      file.name;

    filenameEl.textContent =
      file.name +
      " · " +
      (
        file.size /
        1024 /
        1024
      ).toFixed(2) +
      " MB";

    show("ready");
  }

  /* ---------------------------------------------
     Progress
  --------------------------------------------- */

  function startProgress() {
    stopProgress();

    var percent = 5;

    progressBar.style.width =
      percent + "%";

    progress.setAttribute(
      "aria-valuenow",
      String(percent)
    );

    state.timer =
      setInterval(
        function () {
          percent =
            Math.min(
              percent +
                Math.random() * 5,
              90
            );

          progressBar.style.width =
            percent + "%";

          progress.setAttribute(
            "aria-valuenow",
            String(
              Math.round(percent)
            )
          );
        },
        180
      );
  }

  /* ---------------------------------------------
     Main processing
  --------------------------------------------- */

  async function run() {
    if (!state.file) {
      return;
    }

    setError("");

    show("processing");

    startProgress();

    try {
      console.log(
        "EraseOff processing:",
        state.file.name
      );

      var processed =
        await processImage(
          state.file
        );

      var outputCanvas =
        imageDataToCanvas(
          processed.imageData
        );

      var blob =
        await canvasToBlob(
          outputCanvas
        );

      stopProgress();

      progressBar.style.width =
        "100%";

      progress.setAttribute(
        "aria-valuenow",
        "100"
      );

      state.resultUrl =
        URL.createObjectURL(blob);

      resultImg.src =
        state.resultUrl;

      resultImg.alt =
        "Processed image without Gemini watermark";

      downloadLink.href =
        state.resultUrl;

      downloadLink.setAttribute(
        "download",
        outputName(
          state.file.name
        )
      );

      selectTab("after");

      setTimeout(
        function () {
          show("result");
        },
        220
      );

      console.log(
        "EraseOff: SUCCESS"
      );

    } catch (error) {
      stopProgress();

      progressBar.style.width =
        "0%";

      progress.setAttribute(
        "aria-valuenow",
        "0"
      );

      console.error(
        "EraseOff processing error:",
        error
      );

      show("upload");

      var message =
        error &&
        error.message
          ? error.message
          : String(error);

      setError(
        "Processing error: " +
        message
      );
    }
  }

  /* ---------------------------------------------
     Before / After
  --------------------------------------------- */

  function selectTab(which) {
    var after =
      which === "after";

    tabAfter.setAttribute(
      "aria-selected",
      after
        ? "true"
        : "false"
    );

    tabBefore.setAttribute(
      "aria-selected",
      after
        ? "false"
        : "true"
    );

    resultImg.src =
      after
        ? state.resultUrl
        : state.originalUrl;

    resultImg.alt =
      after
        ? "Processed image without Gemini watermark"
        : "Original image with watermark";
  }

  /* ---------------------------------------------
     Reset
  --------------------------------------------- */

  function reset() {
    stopProgress();

    revokeUrls();

    state.file = null;

    if (input) {
      input.value = "";
    }

    previewImg.removeAttribute(
      "src"
    );

    resultImg.removeAttribute(
      "src"
    );

    setError("");

    progressBar.style.width =
      "0%";

    progress.setAttribute(
      "aria-valuenow",
      "0"
    );

    show("upload");
  }

  /* ---------------------------------------------
     File input
  --------------------------------------------- */

  if (input) {
    input.addEventListener(
      "change",
      function (event) {
        var file =
          event.target.files &&
          event.target.files[0];

        if (file) {
          accept(file);
        }
      }
    );
  }

  /* ---------------------------------------------
     Drag / Drop
  --------------------------------------------- */

  if (dropzone) {
    [
      "dragenter",
      "dragover"
    ].forEach(
      function (eventName) {
        dropzone.addEventListener(
          eventName,
          function (event) {
            event.preventDefault();

            dropzone.classList.add(
              "is-dragover"
            );
          }
        );
      }
    );

    [
      "dragleave",
      "dragend",
      "drop"
    ].forEach(
      function (eventName) {
        dropzone.addEventListener(
          eventName,
          function () {
            dropzone.classList.remove(
              "is-dragover"
            );
          }
        );
      }
    );

    dropzone.addEventListener(
      "drop",
      function (event) {
        event.preventDefault();

        var file =
          event.dataTransfer &&
          event.dataTransfer.files &&
          event.dataTransfer.files[0];

        if (file) {
          accept(file);
        }
      }
    );

    dropzone.addEventListener(
      "click",
      function (event) {
        if (
          event.target.closest(
            "label, input"
          )
        ) {
          return;
        }

        if (input) {
          input.click();
        }
      }
    );
  }

  window.addEventListener(
    "dragover",
    function (event) {
      event.preventDefault();
    }
  );

  window.addEventListener(
    "drop",
    function (event) {
      event.preventDefault();
    }
  );

  /* ---------------------------------------------
     Buttons
  --------------------------------------------- */

  var removeButton =
    $("btn-remove");

  if (removeButton) {
    removeButton.addEventListener(
      "click",
      run
    );
  }

  var cancelButton =
    $("btn-cancel");

  if (cancelButton) {
    cancelButton.addEventListener(
      "click",
      reset
    );
  }

  var againButton =
    $("btn-again");

  if (againButton) {
    againButton.addEventListener(
      "click",
      reset
    );
  }

  /* ---------------------------------------------
     Tabs
  --------------------------------------------- */

  if (tabBefore) {
    tabBefore.addEventListener(
      "click",
      function () {
        selectTab("before");
      }
    );
  }

  if (tabAfter) {
    tabAfter.addEventListener(
      "click",
      function () {
        selectTab("after");
      }
    );
  }

  /* ---------------------------------------------
     FAQ
  --------------------------------------------- */

  Array.prototype.forEach.call(
    document.querySelectorAll(
      ".faq-trigger"
    ),
    function (button) {
      button.addEventListener(
        "click",
        function () {
          var open =
            button.getAttribute(
              "aria-expanded"
            ) === "true";

          button.setAttribute(
            "aria-expanded",
            open
              ? "false"
              : "true"
          );

          var panel =
            button.parentElement &&
            button.parentElement
              .nextElementSibling;

          if (panel) {
            panel.setAttribute(
              "data-open",
              open
                ? "false"
                : "true"
            );
          }
        }
      );
    }
  );

  /* ---------------------------------------------
     Start
  --------------------------------------------- */

  show("upload");

})();

import { createApp, h, ref, watch, computed, type Ref } from "vue";
import FormAutocomplete, {
  type FormAutocompleteItem,
} from "@/components/shared/FormAutocomplete.vue";
import MultiSelect, {
  type MultiSelectOption,
} from "@/components/shared/MultiSelect.vue";
import RoseDesVents from "@/components/shared/RoseDesVents.vue";
import RichTextField from "@/components/shared/RichTextField.vue";

// Helper to create search icon slot
const searchIconSlot = () => ({
  icon: () =>
    h("svg", { class: "w-4 h-4 fill-none stroke-current shrink-0" }, [
      h("use", { href: "#search" }),
    ]),
});

// Shared refs for exposition values (used by both MultiSelect and RoseDesVents)
const expo1Value = ref<string[]>([]);
const expo2Value = ref<string[]>([]);

// Shared ref for falaise name (used by autocomplete)
const falaiseNameValue = ref<string>("");

// Refs vers les composants qui portent leur propre validation "required"
// (cf. window.validateFalaiseForm) : nom (autocomplete) et exposition principale.
type Validatable = { validate: () => boolean };
const nameFieldRef = ref<Validatable | null>(null);
const expo1Ref = ref<Validatable | null>(null);

// Computed strings for the rose component
const expo1String = computed(() => expo1Value.value.join(","));
const expo2String = computed(() => expo2Value.value.join(","));

interface FalaiseItem extends FormAutocompleteItem {
  latlng?: string;
  status?: string;
  nomformate?: string;
}

// Exposition options for multi-select
const expositionOptions: MultiSelectOption[] = [
  { value: "'N'", label: "N" },
  { value: "'S'", label: "S" },
  { value: "'E'", label: "E" },
  { value: "'O'", label: "O" },
  { value: "'NE'", label: "NE" },
  { value: "'NO'", label: "NO" },
  { value: "'SE'", label: "SE" },
  { value: "'SO'", label: "SO" },
  { value: "'NNE'", label: "NNE" },
  { value: "'NNO'", label: "NNO" },
  { value: "'SSE'", label: "SSE" },
  { value: "'SSO'", label: "SSO" },
  { value: "'ENE'", label: "ENE" },
  { value: "'ESE'", label: "ESE" },
  { value: "'OSO'", label: "OSO" },
  { value: "'ONO'", label: "ONO" },
];

// Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("vue-ajout-falaise");
  if (!mountEl) {
    console.warn("[velogrimpe] #vue-ajout-falaise mount point not found");
    return;
  }

  let falaises: FalaiseItem[] = [];
  let isAdmin = false;
  let presetFalaiseId: number | null = null;

  try {
    falaises = JSON.parse(mountEl.dataset.falaises || "[]");
    isAdmin = mountEl.dataset.admin === "true";
    presetFalaiseId = mountEl.dataset.presetFalaiseId
      ? parseInt(mountEl.dataset.presetFalaiseId, 10)
      : null;
  } catch (e) {
    console.error("[velogrimpe] Failed to parse ajout-falaise data:", e);
  }

  // Helper function to format falaise name
  const formatNomFalaise = (nom: string): string => {
    return nom
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 255);
  };

  // Expose fetchAndPrefillData for compatibility with existing code
  const fetchAndPrefillData = (id: number | string) => {
    // This function is defined in the PHP page, call it if available
    if (
      typeof (
        window as unknown as {
          fetchAndPrefillData?: (id: number | string) => void;
        }
      ).fetchAndPrefillData === "function"
    ) {
      (
        window as unknown as {
          fetchAndPrefillData: (id: number | string) => void;
        }
      ).fetchAndPrefillData(id);
    }
  };

  // Create Vue app
  const app = createApp({
    setup() {
      const isDisabled = ref(presetFalaiseId !== null);

      // If editing an existing falaise, pre-fill the value
      if (presetFalaiseId) {
        // The PHP page handles fetching data for existing falaise
        isDisabled.value = true;
      }

      // Au blur de l'autocomplete : si le texte saisi correspond exactement à une
      // falaise existante SANS que l'utilisateur l'ait sélectionnée dans la liste
      // (donc `falaise_id` n'a pas été renseigné par onFalaiseSelect), on affiche
      // l'alerte doublon. Sinon on la masque (cas d'une correction du nom).
      const onFalaiseBlur = (nom: string) => {
        const falaiseDuplicateAlert = document.getElementById(
          "falaiseDuplicateAlert",
        );
        if (!falaiseDuplicateAlert) return;

        const id =
          (document.getElementById("falaise_id") as HTMLInputElement | null)
            ?.value ?? "";

        const existing = falaises.find(
          (f) => f.nom.toLowerCase() === nom.trim().toLowerCase(),
        );
        const isDuplicate = !!existing && String(existing.id) !== id;

        falaiseDuplicateAlert.classList.toggle("hidden", !isDuplicate);

        if (isDuplicate && existing) {
          const link = document.getElementById(
            "linkDuplicatedFalaise",
          ) as HTMLAnchorElement | null;
          const editLink = document.getElementById(
            "linkEditFalaise",
          ) as HTMLAnchorElement | null;
          if (link) link.href = `/falaise.php?falaise_id=${existing.id}`;
          if (editLink)
            editLink.href = `/ajout/ajout_falaise.php?falaise_id=${existing.id}`;
        }
      };

      const onFalaiseSelect = (
        _item: FormAutocompleteItem | null,
        value: string,
      ) => {
        const confirmButton = document.getElementById("confirmButton");
        const falaiseExistsAlert =
          document.getElementById("falaiseExistsAlert");
        const falaiseEditInfo = document.getElementById("falaiseEditInfo");
        const falaiseDuplicateAlert = document.getElementById(
          "falaiseDuplicateAlert",
        );
        const falaiseIdEl = document.getElementById(
          "falaise_id",
        ) as HTMLInputElement;
        const falaiseNomformateEl = document.getElementById(
          "falaise_nomformate",
        ) as HTMLInputElement;
        const falaiseLatlngEl = document.getElementById(
          "falaise_latlng",
        ) as HTMLInputElement;
        const linkSelectedFalaise = document.getElementById(
          "linkSelectedFalaise",
        ) as HTMLAnchorElement;

        if (confirmButton) {
          confirmButton.textContent = "Ajouter la falaise";
        }

        if (!value) {
          // Reset state
          if (falaiseExistsAlert) falaiseExistsAlert.classList.add("hidden");
          if (falaiseEditInfo) falaiseEditInfo.classList.add("hidden");
          if (falaiseDuplicateAlert)
            falaiseDuplicateAlert.classList.add("hidden");
          return;
        }

        // Check if selected value matches an existing falaise
        const existing = falaises.find(
          (f) => f.nom.toLowerCase() === value.toLowerCase(),
        );

        if (existing) {
          // Hide image previews when selecting an existing falaise
          document
            .getElementById("falaise_img1_preview")
            ?.classList.add("hidden");
          document
            .getElementById("falaise_img2_preview")
            ?.classList.add("hidden");
          document
            .getElementById("falaise_img3_preview")
            ?.classList.add("hidden");

          // Set coordinates and formatted name
          if (falaiseLatlngEl && existing.latlng)
            falaiseLatlngEl.value = existing.latlng;
          if (falaiseNomformateEl && existing.nomformate)
            falaiseNomformateEl.value = existing.nomformate;

          // Trigger marker update
          falaiseLatlngEl?.dispatchEvent(new Event("input"));

          if (existing.status === "verrouillée") {
            // Locked falaise
            if (falaiseExistsAlert)
              falaiseExistsAlert.classList.remove("hidden");
            if (falaiseEditInfo) falaiseEditInfo.classList.add("hidden");
            if (falaiseDuplicateAlert)
              falaiseDuplicateAlert.classList.add("hidden");
            if (linkSelectedFalaise) {
              linkSelectedFalaise.href = `/falaise.php?falaise_id=${existing.id}`;
            }
            // Admin can still edit locked falaises
            if (isAdmin) {
              fetchAndPrefillData(existing.id);
            }
          } else {
            // Editable existing falaise
            if (falaiseExistsAlert) falaiseExistsAlert.classList.add("hidden");
            if (falaiseEditInfo) falaiseEditInfo.classList.remove("hidden");
            if (falaiseDuplicateAlert)
              falaiseDuplicateAlert.classList.add("hidden");
            if (falaiseIdEl) falaiseIdEl.value = String(existing.id);
            fetchAndPrefillData(existing.id);
          }
        } else {
          // New falaise
          if (falaiseExistsAlert) falaiseExistsAlert.classList.add("hidden");
          if (falaiseEditInfo) falaiseEditInfo.classList.add("hidden");
          if (falaiseDuplicateAlert)
            falaiseDuplicateAlert.classList.add("hidden");
          // Format the name for URL slug
          if (falaiseNomformateEl)
            falaiseNomformateEl.value = formatNomFalaise(value);
          if (falaiseIdEl) falaiseIdEl.value = "";
        }
      };

      // Watch for changes to update the formatted name
      watch(falaiseNameValue, (newVal) => {
        // Only update nomformate if it's a new falaise (no existing match)
        const existing = falaises.find(
          (f) => f.nom.toLowerCase() === newVal.toLowerCase(),
        );
        if (!existing) {
          const falaiseNomformateEl = document.getElementById(
            "falaise_nomformate",
          ) as HTMLInputElement;
          if (falaiseNomformateEl) {
            falaiseNomformateEl.value = formatNomFalaise(newVal);
          }
        }
      });

      return () =>
        h(
          FormAutocomplete,
          {
            ref: nameFieldRef,
            modelValue: falaiseNameValue.value,
            "onUpdate:modelValue": (v: string) => {
              falaiseNameValue.value = v;
            },
            items: falaises.map((f) => ({
              ...f,
              // Add status to label for better UX
              nom: f.nom,
            })),
            acceptNewValue: true,
            disabled: isDisabled.value,
            onSelect: onFalaiseSelect,
            onBlur: onFalaiseBlur,
            name: "falaise_nom",
            required: true,
            // Le champ reste readonly tant qu'il n'a pas le focus : l'autofill
            // navigateur (qui ignore autocomplete="off") et les gestionnaires
            // de mots de passe sautent les champs readonly et ne peuvent plus
            // injecter le nom de l'utilisateur au moment du submit.
            preventAutofill: true,
            // Empêche les outils de remplissage auto (navigateur + gestionnaires
            // de mots de passe) d'injecter le nom de l'utilisateur dans le nom
            // de la falaise, à cause du libellé « Nom de la falaise ».
            inputAttrs: {
              id: "falaise_libelle",
              "data-1p-ignore": "",
              "data-lpignore": "true",
              "data-bwignore": "",
              "data-form-type": "other",
            },
          },
          searchIconSlot(),
        );
    },
  });

  // Mount the app
  app.mount(mountEl);
  console.log("[velogrimpe] Vue ajout-falaise autocomplete mounted");

  // Expose setter for prefill from PHP
  (window as unknown as Record<string, unknown>).setFalaiseNom = (
    value: string,
  ) => {
    falaiseNameValue.value = value;
  };

  // Fetch and prefill data for existing falaise (called here to guarantee setters are ready)
  if (presetFalaiseId) {
    const fetchFn = (window as unknown as Record<string, (id: number) => void>)
      .fetchAndPrefillData;
    if (fetchFn) fetchFn(presetFalaiseId);
  }

  // Mount exposition multi-selects
  mountExpositionSelects(isAdmin);

  // Mount rich text editors (TipTap) on the textarea-replacement mount points
  mountRichTextFields();
});

// Registry of mounted rich text editors, keyed by field name, for PHP prefill.
type RichTextApi = {
  setContent: (html: string) => void;
  validate: () => boolean;
};
const richTextRefs: Record<string, Ref<RichTextApi | null>> = {};

function mountRichTextFields() {
  document.querySelectorAll<HTMLElement>(".vue-richtext").forEach((el) => {
    const name = el.dataset.name;
    if (!name) return;
    const initial = el.dataset.value || "";
    // Le caractère obligatoire est porté par le champ lui-même (data-required),
    // comme un input classique.
    const required = el.dataset.required === "true";
    const cmpRef = ref<RichTextApi | null>(null);

    const app = createApp({
      setup() {
        return () =>
          h(RichTextField, {
            name,
            modelValue: initial,
            required,
            ref: cmpRef,
          });
      },
    });
    app.mount(el);
    richTextRefs[name] = cmpRef;
  });

  // Expose setter so fetchAndPrefillData (PHP) can fill editors in edit mode.
  (window as unknown as Record<string, unknown>).setRichText = (
    name: string,
    html: string,
  ) => {
    richTextRefs[name]?.value?.setContent(html || "");
  };

  // Valide tous les champs custom obligatoires du formulaire falaise (rich-text,
  // autocomplete du nom, exposition principale). Chaque champ porte son propre
  // `required` et affiche son erreur. Renvoie true si tout est valide, sinon
  // défile vers le premier invalide. Appelé par le handler de soumission (PHP).
  (window as unknown as Record<string, unknown>).validateFalaiseForm =
    (): boolean => {
      let firstInvalid: HTMLElement | null = null;
      const check = (ok: boolean, el: HTMLElement | null) => {
        if (!ok && !firstInvalid && el) firstInvalid = el;
      };
      // Champs rich-text
      document.querySelectorAll<HTMLElement>(".vue-richtext").forEach((el) => {
        const name = el.dataset.name;
        if (!name) return;
        check(richTextRefs[name]?.value?.validate() ?? true, el);
      });
      // Autocomplete du nom + exposition principale
      check(
        nameFieldRef.value?.validate() ?? true,
        document.getElementById("vue-ajout-falaise"),
      );
      check(
        expo1Ref.value?.validate() ?? true,
        document.getElementById("vue-exposhort1"),
      );

      if (firstInvalid)
        (firstInvalid as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      return !firstInvalid;
    };
}

// Helper to parse comma-separated values with quotes (e.g., "'N','S'" -> ["'N'", "'S'"])
function parseExpositionValue(value: string): string[] {
  if (!value) return [];
  // Split by comma and trim, keeping the quotes
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function mountExpositionSelects(isAdmin: boolean) {
  // Mount exposhort1 (required hors admin, comme côté serveur)
  const expo1El = document.getElementById("vue-exposhort1");
  if (expo1El) {
    const presetValue = expo1El.dataset.value || "";
    expo1Value.value = parseExpositionValue(presetValue);

    const expo1App = createApp({
      setup() {
        return () =>
          h(MultiSelect, {
            ref: expo1Ref,
            modelValue: expo1Value.value,
            "onUpdate:modelValue": (v: string[]) => {
              expo1Value.value = v;
            },
            options: expositionOptions,
            name: "falaise_exposhort1",
            required: !isAdmin,
            placeholder: "Sélectionner...",
          });
      },
    });
    expo1App.mount(expo1El);
  }

  // Mount exposhort2 (optional)
  const expo2El = document.getElementById("vue-exposhort2");
  if (expo2El) {
    const presetValue = expo2El.dataset.value || "";
    expo2Value.value = parseExpositionValue(presetValue);

    const expo2App = createApp({
      setup() {
        return () =>
          h(MultiSelect, {
            modelValue: expo2Value.value,
            "onUpdate:modelValue": (v: string[]) => {
              expo2Value.value = v;
            },
            options: expositionOptions,
            name: "falaise_exposhort2",
            required: false,
            placeholder: "Sélectionner...",
          });
      },
    });
    expo2App.mount(expo2El);
  }

  // Mount rose des vents preview
  const roseEl = document.getElementById("vue-rose-preview");
  if (roseEl) {
    const roseApp = createApp({
      setup() {
        return () =>
          h(RoseDesVents, {
            expo1: expo1String.value,
            expo2: expo2String.value,
            size: 100,
          });
      },
    });
    roseApp.mount(roseEl);
  }

  // Expose setters for prefill from PHP
  (window as unknown as Record<string, unknown>).setExpo1Value = (
    value: string,
  ) => {
    expo1Value.value = parseExpositionValue(value);
  };
  (window as unknown as Record<string, unknown>).setExpo2Value = (
    value: string,
  ) => {
    expo2Value.value = parseExpositionValue(value);
  };
}

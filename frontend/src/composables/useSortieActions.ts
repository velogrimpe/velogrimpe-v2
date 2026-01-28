import { ref, computed } from "vue";
import type { Sortie } from "@/types/sortie";
import { useToast } from "./useToast";

export function useSortieActions(sortie: () => Sortie | null) {
  const isParticipationModalOpen = ref(false);
  const { showToast } = useToast();

  const dateDisplay = computed(() => {
    const s = sortie();
    if (!s) return "";

    const debut = new Date(s.date_debut);
    const debutStr = debut.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    if (s.date_fin && s.date_fin !== s.date_debut) {
      const fin = new Date(s.date_fin);
      const finStr = fin.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      return `Du ${debutStr} au ${finStr}`;
    }

    return debutStr;
  });

  function openParticipationModal() {
    isParticipationModalOpen.value = true;
  }

  function closeParticipationModal() {
    isParticipationModalOpen.value = false;
  }

  function copyLink() {
    navigator.clipboard.writeText(
      window.location.origin + `/sortie.php?sortie_id=${sortie()?.sortie_id}`,
    );
    showToast("Lien copié !", "success");
  }

  async function handleGroupLinkClick() {
    const s = sortie();
    if (!s) return;

    try {
      const formData = new FormData();
      formData.append("sortie_id", s.sortie_id.toString());

      await fetch("/api/increment_interest.php", {
        method: "POST",
        body: formData,
      });
    } catch (error) {
      console.error("Error incrementing interest:", error);
    }
  }

  return {
    isParticipationModalOpen,
    dateDisplay,
    openParticipationModal,
    closeParticipationModal,
    copyLink,
    handleGroupLinkClick,
  };
}

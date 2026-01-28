<script setup lang="ts">
import type { Sortie } from "@/types/sortie";
import Icon from "../shared/Icon.vue";

defineProps<{
  sortie: Sortie;
  dateDisplay: string;
  onGroupLinkClick: () => void;
  onParticipationClick: () => void;
  onCopyLink: () => void;
}>();
</script>

<template>
  <!-- Breadcrumb (only for full page, can be hidden with class) -->
  <a class="text-primary font-bold sortie-breadcrumb" href="/sorties.php"
    >← Retour à la liste des sorties</a
  >

  <!-- Title -->
  <div class="flex flex-col items-start mb-4">
    <h1 class="text-3xl md:text-2xl font-bold mb-2 md:mb-0">
      Sortie vélogrimpe à {{ sortie.falaise_principale_nom }}
    </h1>
    <a
      v-if="sortie.falaise_principale_id"
      :href="`/falaise.php?falaise_id=${sortie.falaise_principale_id}`"
      class="link link-primary text-sm"
      target="_blank"
    >
      Voir la fiche falaise
    </a>
  </div>

  <!-- Date -->
  <div class="mb-4">
    <div class="text-sm text-base-content/70">Date</div>
    <div class="text-lg">{{ dateDisplay }}</div>
  </div>

  <!-- Ville de départ -->
  <div class="mb-4">
    <div class="text-sm text-base-content/70">Ville de départ</div>
    <div class="text-lg">{{ sortie.ville_depart }}</div>
  </div>

  <!-- Falaises alternatives -->
  <div
    v-if="
      sortie.falaises_alternatives && sortie.falaises_alternatives.length > 0
    "
    class="mb-4"
  >
    <div class="text-sm text-base-content/70">Falaises alternatives</div>
    <div class="flex flex-wrap gap-2 mt-1">
      <span
        v-for="(falaise, index) in sortie.falaises_alternatives"
        :key="index"
        class="badge badge-outline"
      >
        {{ falaise.nom }}
        <a
          v-if="falaise.id"
          :href="`/falaise.php?falaise_id=${falaise.id}`"
          class="ml-1 link link-primary"
          ><Icon name="external-link"
        /></a>
      </span>
    </div>
  </div>

  <!-- Itinéraire vélo -->
  <div v-if="sortie.velo_nom" class="mb-4">
    <div class="text-sm text-base-content/70">Itinéraire vélo prévu</div>
    <div class="text-lg">{{ sortie.velo_nom }}</div>
  </div>

  <!-- Description -->
  <div class="mb-4">
    <div class="text-sm text-base-content/70 mb-2">Description</div>
    <div class="prose prose-sm max-w-none whitespace-pre-wrap">
      {{ sortie.description }}
    </div>
  </div>

  <!-- Lien du groupe -->
  <div v-if="sortie.lien_groupe" class="mb-4">
    <div class="text-sm text-base-content/70 mb-2">Groupe de discussion</div>
    <a
      :href="sortie.lien_groupe"
      target="_blank"
      rel="noopener noreferrer"
      class="link link-primary"
      @click="onGroupLinkClick"
    >
      Rejoindre le groupe →
    </a>
  </div>

  <!-- Nombre d'intéressés -->
  <div class="mb-6">
    <div class="text-sm text-base-content/70">
      {{ sortie.nb_interesses }} personne{{
        sortie.nb_interesses > 1 ? "s" : ""
      }}
      intéressée{{ sortie.nb_interesses > 1 ? "s" : "" }}
    </div>
  </div>

  <!-- Participation button -->
  <div class="mt-6">
    <button
      v-if="!sortie.is_past"
      class="btn btn-primary w-full"
      @click="onParticipationClick"
    >
      Je suis intéressé(e)
    </button>
    <div v-else class="alert alert-info">
      <span>Cette sortie est passée</span>
    </div>
  </div>

  <!-- Organisateur info -->
  <div class="mt-6 text-sm text-base-content/60">
    Sortie proposée par {{ sortie.organisateur_nom }}
  </div>

  <!-- Share button -->
  <div class="mt-4 text-center">
    <button class="btn btn-sm btn-outline" @click="onCopyLink">
      📋 Copier le lien de la sortie
    </button>
  </div>
</template>

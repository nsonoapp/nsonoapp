export const HELP_TUTORIALS = [
  {
    id: "vente",
    title: "Vente",
    page: "index.html",
    role: "Enregistrer les ventes au quotidien, encaisser et générer automatiquement stock et dettes.",
    howTo: "Ouvrez la page Vente, ajoutez des produits au panier, renseignez le client, choisissez le mode de paiement puis validez.",
    todo: "Saisir le nom du client, vérifier les quantités, respecter le prix minimum et confirmer chaque vente le jour même.",
    body: "Cliquez sur un produit pour l'ajouter au panier. Ajustez les quantités et les prix si vous êtes autorisé. Choisissez « Paiement total » ou « Paiement partiel » pour une dette client. Chaque vente crée une fiche dans sales, des lignes dans sale_items et un mouvement OUT dans stock_movements. Les produits périssables utilisent le FIFO : les lots expirés ne peuvent pas être vendus."
  },
  {
    id: "vendus",
    title: "Vendus",
    page: "vendus.html",
    role: "Consulter l'historique détaillé des ventes par période, vendeur, produit et statut.",
    howTo: "Choisissez une période (Aujourd'hui par défaut), appliquez les filtres puis consultez les cartes et les KPIs.",
    todo: "Vérifier chaque jour les ventes du jour, filtrer par vendeur si besoin et contrôler les dettes encore ouvertes.",
    body: "Les filtres interrogent Firestore directement : dates, vendeur, paiement, statut et produit. Par défaut, la page affiche les ventes d'aujourd'hui. Les vendeurs ne voient que leurs propres ventes. Utilisez « Réinitialiser » pour revenir à la journée en cours."
  },
  {
    id: "produits",
    title: "Produits",
    page: "products.html",
    role: "Créer et maintenir le catalogue : prix, stock, alertes et options offline ou expiration.",
    howTo: "Ajoutez un produit avec prix achat, vente et minimum. Indiquez le stock initial. Modifiez ou désactivez via la liste.",
    todo: "Tenir les prix à jour, activer l'expiration si le produit est périssable, vérifier le stock affiché après chaque achat ou vente.",
    body: "stock_current est un cache d'affichage — la vérité reste stock_movements. price_min bloque une vente en dessous du seuil. offlineBlocked et minOfflineStock protègent les ventes hors-ligne. Si l'expiration est activée dans Paramètres, cochez hasExpiration et renseignez la date du lot initial."
  },
  {
    id: "achats",
    title: "Achats",
    page: "purchases.html",
    role: "Enregistrer les entrées stock fournisseur et mettre à jour les coûts d'achat.",
    howTo: "Sélectionnez le produit, la quantité, le prix d'achat et validez. Corrigez le stock manuellement si nécessaire via le tableau.",
    todo: "Saisir chaque réception fournisseur, renseigner la date d'expiration du lot si le produit est périssable, contrôler le bénéfice potentiel affiché.",
    body: "Chaque achat crée purchases, purchase_items et un mouvement IN. Une dépense de réinvestissement peut être générée automatiquement. Le tableau affiche le bénéfice potentiel (prix min − prix achat). Seul le tableau défile horizontalement sur mobile."
  },
  {
    id: "finances",
    title: "Finances (hub)",
    page: "finances.html",
    role: "Point central vers Dépenses, Dettes et Pertes avec vue d'ensemble des alertes.",
    howTo: "Depuis cette page, ouvrez le module concerné : Dépenses, Dettes ou Pertes.",
    todo: "Consulter régulièrement les alertes dettes, traiter les échéances et maintenir les trois modules à jour.",
    body: "La page Finances regroupe l'accès aux charges, créances et pertes. Utilisez-la comme tableau de bord financier avant d'entrer dans le détail de chaque sous-page."
  },
  {
    id: "depenses",
    title: "Dépenses",
    page: "expenses.html",
    role: "Suivre toutes les sorties d'argent : charges, investissements et réinvestissements.",
    howTo: "Remplissez le formulaire (libellé, montant, catégorie, date), puis créez la dépense. Filtrez par période avec « Appliquer filtres ».",
    todo: "Enregistrer chaque dépense réelle, classer correctement (salaire, loyer, investissement…), ne pas mélanger charge courante et investissement stock.",
    body: "Les catégories investment et reinvestment servent au suivi des achats stock et réapprovisionnements. Les filtres date passent par Firestore. Modifiez une dépense via le bouton dédié si le montant était incorrect."
  },
  {
    id: "dettes",
    title: "Dettes",
    page: "debts.html",
    role: "Gérer les créances clients et dettes fournisseurs avec échéances et paiements partiels.",
    howTo: "Créez une dette (nom, montant total, montant payé, échéance). Enregistrez les paiements via le bouton Payer sur chaque ligne.",
    todo: "Relancer les clients en retard, saisir l'échéance (J+7 par défaut), enregistrer chaque encaissement partiel dès réception.",
    body: "Une dette liée à une vente (relatedSaleId) met à jour automatiquement le payment_status de la vente. Le bandeau « Suivi Dettes » résume retards, échéances du jour et montants restants. Montants : utilisez un point ou une virgule décimale."
  },
  {
    id: "pertes",
    title: "Pertes",
    page: "losses.html",
    role: "Déclarer les pertes produit (casse, expiration) ou financières et corriger si erreur.",
    howTo: "Choisissez le type de perte, le produit ou le montant, validez. Utilisez Corriger pour une perte produit enregistrée par erreur.",
    todo: "Sortir le stock expiré via une perte produit (FIFO), documenter la raison, ne pas laisser le stock expiré en vente.",
    body: "Une perte produit génère un mouvement OUT reason loss. Les produits périssables consomment les lots les plus anciens. Les pertes financières n'affectent pas le stock mais impactent les statistiques."
  },
  {
    id: "stats",
    title: "Statistiques",
    page: "stats.html",
    role: "Analyser la performance : ventes, profits, dépenses, stock, dettes et alertes (admin).",
    howTo: "Choisissez la période et le vendeur, consultez les KPIs et graphiques, exportez le PDF si besoin.",
    todo: "Consulter au moins une fois par semaine, comparer les périodes, agir sur les alertes stock et expiration.",
    body: "Réservé au rôle admin. Les chiffres proviennent de sales, sale_items, expenses, losses, purchases et stock_movements. Santé financière : dépenses hors investissement, investissements, réinvestissements et bénéfice potentiel au prix minimum."
  },
  {
    id: "parametres",
    title: "Paramètres",
    page: "admin/settings.html",
    role: "Configurer la boutique, les utilisateurs, l'expiration produits et le mode offline.",
    howTo: "Onglet Configuration : nom boutique, devise, alertes stock, expiration. Onglet Utilisateurs : créer admin ou seller, activer/désactiver.",
    todo: "Limiter les accès seller, activer l'expiration si vous vendez des produits périssables, sauvegarder après chaque modification.",
    body: "enableExpiration et expirationAlertDays contrôlent le module FIFO et les alertes dashboard. Chaque utilisateur Firebase doit avoir un document dans users avec le bon rôle. Ne partagez jamais les mots de passe admin."
  },
  {
    id: "utilisateurs",
    title: "Utilisateurs",
    page: "admin/settings.html",
    role: "Contrôler qui accède à NSONO et avec quel niveau de permission (admin ou seller).",
    howTo: "Dans Paramètres → Utilisateurs, créez un compte, assignez le rôle, activez ou désactivez l'accès.",
    todo: "Un seller par point de vente si possible, révoquer l'accès des anciens employés, ne jamais laisser de compte inactif ouvert.",
    body: "admin : accès Stats, Paramètres, toutes les ventes. seller : vente et modules autorisés, ventes limitées à son sellerId sur Vendus. Les nouveaux comptes passent par approbation admin."
  },
  {
    id: "navigation",
    title: "Navigation (Sidebar)",
    page: "index.html",
    role: "Accéder aux modules via le tiroir persistant et filtré par rôle.",
    howTo: "Sur desktop/tablette, utilisez la sidebar fixe à gauche. Sur mobile, ouvrez-la avec le bouton ☰.",
    todo: "Vérifier que les liens Admin/Stats ne s'affichent que pour les admins autorisés.",
    body: "La navigation est centralisée dans le tiroir. Les liens sont dynamiques selon les permissions."
  },
  {
    id: "loader",
    title: "Vue rapide",
    page: "loader.html",
    role: "Aperçu synthétique des ventes, du stock et des finances sans ouvrir chaque module.",
    howTo: "Ouvrez loader.html depuis le menu Navigation ou Stats selon votre configuration.",
    todo: "Consultez en début de journée pour un état rapide avant d'entrer dans le détail des ventes.",
    body: "Dashboard léger pour les vendeurs ou managers pressés. Complète Stats mais ne remplace pas une analyse approfondie."
  },
  {
    id: "aide",
    title: "Aide",
    page: "help.html",
    role: "Guide complet NSONO et présentation ES-Company.",
    howTo: "Parcourez les tutoriels accordéon, lisez « Pourquoi NSONO » et contactez le support si besoin.",
    todo: "Former chaque nouvel utilisateur avec cette page avant la première vente réelle.",
    body: "Un seul chapitre ouvert à la fois. Retrouvez ici la logique métier, les contacts et le lien vers le site ES-Company."
  }
];

export const ES_COMPANY_ABOUT = {
  mission:
    "Moderniser la gestion des commerces locaux grâce à des outils simples, professionnels et adaptés aux réalités africaines.",
  history:
    "Tout a commencé dans une boutique physique : gestion sur papier, calculs longs, stock difficile à suivre. En échangeant avec d'autres commerçants, la même problématique revenait — organisation, pas seulement visibilité web. NSONO est né pour répondre à ce besoin concret, puis ES-Company est devenue le véhicule pour aider d'autres entreprises à se moderniser.",
  approach:
    "Nous ne vendons pas des logiciels : nous construisons un écosystème numérique qui combine technologie, stratégie business, design professionnel et accompagnement pratique."
};

export const NSONO_WHY = {
  pointA: [
    "Cahiers papier et calculs manuels",
    "Difficulté à connaître le vrai bénéfice",
    "Stock mal suivi et pertes invisibles",
    "Dettes mal contrôlées",
    "Décisions prises au hasard"
  ],
  pointB: [
    "Suivi clair des ventes en temps réel",
    "Contrôle du stock via stock_movements",
    "Gestion des dépenses et des dettes",
    "Réduction des pertes (dont expiration)",
    "Statistiques lisibles pour décider",
    "Entreprise plus organisée et rentable"
  ],
  promise:
    "NSONO aide les commerçants à passer d'une gestion approximative sur papier à une gestion organisée et contrôlée, afin de mieux suivre leur argent, réduire les pertes et prendre de meilleures décisions.",
  centralMessage:
    "Vous n'avez pas besoin de travailler plus. Vous avez besoin de mieux contrôler votre activité. NSONO vous aide à savoir où va votre argent, à réduire les pertes et à prendre de meilleures décisions pour développer votre entreprise."
};

export const HELP_CONTACT = {
  email: "escompany98@gmail.com",
  phonePrimary: "+243843858955",
  phonePrimaryDisplay: "+243 843 858 955",
  phoneSecondary: "+243840344307",
  phoneSecondaryDisplay: "+243 840 344 307",
  website: "https://es-company98.github.io/Es-Company/",
  whatsappPrimary: "243843858955",
  whatsappMessage:
    "Bonjour ES-Company, j'utilise NSONO et j'ai besoin d'aide ou de support."
};

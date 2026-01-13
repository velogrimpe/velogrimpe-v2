<?php
/**
 * Configuration template for velogrimpe.fr
 * Copy this file to config.php and fill in your values
 */
return [
    // Main database (velogrimpe)
    'db_name' => 'velogrimpe',
    'db_user' => 'your_db_user',
    'db_pass' => 'your_db_password',

    // SNCF train schedules database
    'sncf_db_name' => 'sncf',
    'sncf_db_user' => 'your_sncf_db_user',
    'sncf_db_pass' => 'your_sncf_db_password',

    // API tokens
    'admin_token' => 'your_admin_token',
    'contrib_token' => 'your_contrib_token',
    'vg_token' => 'your_vg_token',

    // Contact
    'contact_mail' => 'contact@example.com',

    // Oblyk API integration
    'oblyk_token' => 'your_oblyk_token',

    // Mailgun configuration
    'mailgun_api_key' => 'your_mailgun_api_key',
    'mailgun_domain' => 'mail.yourdomain.com',
    'mailgun_baseurl' => 'https://api.eu.mailgun.net',

    // Base URL (http://localhost for dev, https://velogrimpe.fr for prod)
    'base_url' => 'http://localhost',
];

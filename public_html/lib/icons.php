<?php
/**
 * Icon helper function
 *
 * Displays an icon from the SVG sprite at /symbols/icons.svg
 *
 * Usage:
 *   <?= icon('search') ?>
 *   <?= icon('search', 'w-6 h-6 text-primary') ?>
 *   <?= icon('filter', 'w-4 h-4', ['title' => 'Filtrer']) ?>
 *
 * @param string $name Icon name (e.g., 'search', 'filter', 'close')
 * @param string $class CSS classes (default: 'w-4 h-4 fill-current')
 * @param array $attrs Additional SVG attributes
 * @return string HTML string
 */
function icon(string $name, string $class = 'w-4 h-4 fill-current', array $attrs = []): string
{
    $class = htmlspecialchars($class, ENT_QUOTES, 'UTF-8');
    $name = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');

    $attrStr = '';
    foreach ($attrs as $key => $value) {
        $key = htmlspecialchars($key, ENT_QUOTES, 'UTF-8');
        $value = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
        $attrStr .= " {$key}=\"{$value}\"";
    }

    return <<<HTML
<svg class="{$class}" aria-hidden="true"{$attrStr}>
    <use xlink:href="/symbols/icons.svg#{$name}"></use>
</svg>
HTML;
}

/**
 * Mapping from old ri-* icon names to new names
 * Use this during migration to find the new name
 */
function icon_migrate(string $oldName): string
{
    $map = [
        'ri-search-line' => 'search',
        'ri-filter-line' => 'filter',
        'ri-close-line' => 'close',
        'ri-mail-line' => 'mail',
        'ri-mail-fill' => 'mail-fill',
        'ri-phone-line' => 'phone',
        'ri-user-line' => 'user',
        'ri-pencil-line' => 'pencil',
        'ri-external-link-line' => 'external-link',
        'ri-checkbox-circle-fill' => 'checkbox-circle-fill',
        'ri-error-warning-fill' => 'error-warning-fill',
        'ri-information-line' => 'information',
        'ri-save-3-fill' => 'save',
        'ri-file-upload-line' => 'file-upload',
        'ri-chat-4-line' => 'chat',
        'ri-building-2-line' => 'building',
        'ri-ticket-line' => 'ticket',
        'ri-sun-foggy-fill' => 'sun-foggy',
        'ri-sun-cloudy-fill' => 'sun-cloudy',
        'ri-riding-line' => 'riding',
        'ri-footprint-fill' => 'footprint',
        'ri-login-circle-line' => 'login',
        'ri-logout-circle-r-line' => 'logout',
        'ri-table-line' => 'table',
        'ri-sort-desc' => 'sort-desc',
        'ri-link' => 'link',
        'ri-eye-fill' => 'eye',
        'ri-arrow-right-line' => 'arrow-right',
    ];

    return $map[$oldName] ?? $oldName;
}

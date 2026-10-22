{{-- Callout note box. Vars: $slot text via $text, optional $tone ('info'|'warning'|'success') --}}
@php($tone = $tone ?? 'info')
@php($map = [
    'info'    => ['bg' => '#f1f8f5', 'bar' => '#008060', 'text' => '#1f5a48'],
    'success' => ['bg' => '#eef9f1', 'bar' => '#1f9d55', 'text' => '#1c5a37'],
    'warning' => ['bg' => '#fff7ed', 'bar' => '#d97706', 'text' => '#92580f'],
])
@php($c = $map[$tone] ?? $map['info'])
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px;">
    <tr>
        <td
            style="background-color: {{ $c['bg'] }}; border-left: 4px solid {{ $c['bar'] }}; border-radius: 8px; padding: 16px 18px;">
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: {{ $c['text'] }};">
                {{ $text }}
            </p>
        </td>
    </tr>
</table>

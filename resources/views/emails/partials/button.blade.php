{{-- Primary CTA button. Vars: $url, $label, optional $variant ('primary'|'neutral') --}}
@php($variant = $variant ?? 'primary')
@php($bg = $variant === 'neutral' ? '#1a1d21' : '#008060')
@php($shadow = $variant === 'neutral' ? 'rgba(26,29,33,0.22)' : 'rgba(0,128,96,0.28)')
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 4px auto;">
    <tr>
        <td align="center" style="border-radius: 10px; background-color: {{ $bg }}; box-shadow: 0 3px 8px {{ $shadow }};">
            <a href="{{ $url }}" target="_blank"
                style="display: inline-block; padding: 14px 34px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px; letter-spacing: 0.01em;">
                {{ $label }}
            </a>
        </td>
    </tr>
</table>

{{-- Stat chips row. Var: $stats = [['label' => '...', 'value' => '...', 'accent' => '#008060'?], ...] --}}
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 8px 0 28px;">
    <tr>
        @foreach ($stats as $stat)
            <td class="sm-stack sm-stack-mb" valign="top"
                style="width: {{ floor(100 / max(count($stats), 1)) }}%; padding: 0 6px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color: #f5f8f7; border: 1px solid #e6ece9; border-radius: 12px;">
                    <tr>
                        <td style="padding: 16px 14px; text-align: center;">
                            <div
                                style="font-size: 24px; font-weight: 700; line-height: 1.1; color: {{ $stat['accent'] ?? '#0b6b54' }};">
                                {{ $stat['value'] }}
                            </div>
                            <div
                                style="margin-top: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280;">
                                {{ $stat['label'] }}
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        @endforeach
    </tr>
</table>

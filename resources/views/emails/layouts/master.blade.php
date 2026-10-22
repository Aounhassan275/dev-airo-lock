<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <title>@yield('title', config('app.name'))</title>
    <!--[if mso]>
    <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
    <![endif]-->
    <style>
        @media only screen and (max-width: 600px) {
            .sm-px { padding-left: 24px !important; padding-right: 24px !important; }
            .sm-py { padding-top: 28px !important; padding-bottom: 28px !important; }
            .sm-stack { display: block !important; width: 100% !important; }
            .sm-stack-mb { margin-bottom: 12px !important; }
        }
    </style>
</head>

<body
    style="margin: 0; padding: 0; width: 100%; background-color: #eef1f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1d21; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%;">

    {{-- Hidden preheader (preview text in inbox) --}}
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #eef1f4;">
        {{ $preheader ?? config('app.name') }}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
        style="background-color: #eef1f4;">
        <tr>
            <td align="center" style="padding: 32px 16px;">

                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600"
                    style="width: 100%; max-width: 600px; margin: 0 auto;">

                    {{-- ───────── Brand bar ───────── --}}
                    <tr>
                        <td style="padding: 0 8px 18px; text-align: center;">
                            <span style="font-size: 15px; font-weight: 700; letter-spacing: 0.02em; color: #0b6b54;">
                                Airo&nbsp;·&nbsp;Access Lock
                            </span>
                        </td>
                    </tr>

                    {{-- ───────── Card ───────── --}}
                    <tr>
                        <td style="background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 30px -8px rgba(16, 32, 28, 0.12);">

                            {{-- Header / hero --}}
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td class="sm-px sm-py"
                                        style="background-color: #008060; background-image: linear-gradient(135deg, #00a37a 0%, #008060 55%, #006b51 100%); padding: 40px 40px 36px; text-align: center;">
                                        <div
                                            style="display: inline-block; width: 60px; height: 60px; line-height: 60px; border-radius: 16px; background-color: rgba(255,255,255,0.16); font-size: 28px; margin-bottom: 18px;">
                                            @yield('icon', '✨')
                                        </div>
                                        <h1
                                            style="margin: 0 0 8px; font-size: 23px; font-weight: 700; letter-spacing: -0.02em; color: #ffffff; line-height: 1.3;">
                                            @yield('heading')
                                        </h1>
                                        <p style="margin: 0; font-size: 15px; line-height: 1.5; color: #d6f3ea;">
                                            @yield('subheading')
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            {{-- Body --}}
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td class="sm-px sm-py" style="padding: 40px;">
                                        @yield('content')
                                    </td>
                                </tr>
                            </table>

                        </td>
                    </tr>

                    {{-- ───────── Footer ───────── --}}
                    <tr>
                        <td style="padding: 28px 24px 8px; text-align: center;">
                            <p style="margin: 0 0 10px; font-size: 13px; line-height: 1.6; color: #6b7280;">
                                Need a hand? We're here for you —
                                <a href="mailto:{{ config('mail.from.address') }}"
                                    style="color: #0b6b54; text-decoration: none; font-weight: 600;">{{ config('mail.from.address') }}</a>
                            </p>
                            <p style="margin: 0 0 14px; font-size: 13px; line-height: 1.6;">
                                <a href="{{ ($appUrl ?? config('app.url')) }}"
                                    style="color: #6b7280; text-decoration: underline;">Open the app</a>
                                &nbsp;·&nbsp;
                                <a href="mailto:{{ config('mail.from.address') }}"
                                    style="color: #6b7280; text-decoration: underline;">Contact support</a>
                            </p>
                            <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #9aa1a9;">
                                &copy; {{ date('Y') }} {{ config('app.name') }}. All rights reserved.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>

</html>

<?php

return [

    /*
     | Crisp website id for THIS app. Without it the chatbox is not rendered at
     | all, so a new app is safe to deploy before the id is set.
     */
    'website_id' => env('CRISP_WEBSITE_ID'),

    /*
     | Shown to the support agent as `app_name` beside the conversation, so one
     | agent can tell which of our apps the merchant is writing from.
     */
    'app_name' => env('CRISP_APP_NAME', config('app.name')),

    /*
     | Optional avatar for the chatbox (e.g. the app's icon from the App Store
     | listing). Leave unset to skip it.
     */
    'avatar' => env('CRISP_AVATAR_URL'),

];

import { DesktopIcon, EmailIcon, GlobeIcon, HashtagIcon, KeyIcon, LinkIcon, PersonIcon } from '@shopify/polaris-icons';

export const CONDITION_TYPES = [
    { label: 'If user is tagged with...', value: 'tag', icon: HashtagIcon },
    { label: 'If user is signed in', value: 'signedIn', icon: PersonIcon },
    { label: 'If user gives the passcode...', value: 'singlePasscode', icon: KeyIcon },
    { label: 'If user gives one of many passcodes...', value: 'multiplePasscodes', icon: LinkIcon },
    { label: 'If user arrives via a secret link...', value: 'singleSecretLink', icon: LinkIcon },
    { label: 'If user is visiting from a certain location', value: 'location', icon: GlobeIcon },
    { label: 'If user has a certain email address', value: 'specificEmail', icon: EmailIcon },
    { label: 'If user email address contains...', value: 'emailContains', icon: EmailIcon },
    { label: 'If user email is on a list...', value: 'emailFromList', icon: EmailIcon },
    { label: 'If user gives the passcode issued to their email...', value: 'pairedCredentials', icon: KeyIcon },
    { label: 'If user has a certain IP address', value: 'ip', icon: DesktopIcon },
    { label: 'If user confirms their age...', value: 'ageVerification', icon: PersonIcon },
];

export const USER_STATE_OPTIONS = [
    { label: 'Logged-in customers', value: 'loggedIn' },
    { label: 'Guests', value: 'guest' },
];

export const COUNTRY_OPTIONS = [
    { label: 'United States', value: 'US' },
    { label: 'Pakistan', value: 'PK' },
    { label: 'United Kingdom', value: 'GB' },
    { label: 'Canada', value: 'CA' },
    { label: 'Custom…', value: 'custom' },
];

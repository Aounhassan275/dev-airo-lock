<?php

namespace App\Http\Controllers;

use App\Models\AccessRule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AccessController extends Controller
{
    public function checkAccessWeb(Request $request)
    {
        // Simple check implementation - optimize later
        $handle = $request->input('handle');
        $type = $request->input('resource_type');

        // Logic to check rules in DB
        // For now, return open access or mock response

        return response()->json(['locked' => false]);
    }

    public function validatePasscode(Request $request)
    {
        $passcode = $request->input('passcode');
        $rule_id = $request->input('rule_id');

        $rule = AccessRule::find($rule_id);

        if (!$rule) {
            return response()->json(['valid' => false, 'message' => 'Lock configuration not found']);
        }

        // Extract simple passcodes
        $validPasscodes = $this->extractPasscodes($rule->conditions);

        if (in_array($passcode, $validPasscodes)) {
            return response()->json(['valid' => true]);
        }

        return response()->json(['valid' => false, 'message' => 'Incorrect passcode']);
    }

    private function extractPasscodes($conditions)
    {
        $codes = [];
        if (!is_array($conditions)) return $codes;

        foreach ($conditions as $group) {
            if (isset($group['conditions'])) {
                foreach ($group['conditions'] as $cond) {
                    if (($cond['type'] === 'singlePasscode' || $cond['type'] === 'passcode') && !empty($cond['value'])) {
                        $codes[] = $cond['value'];
                    }
                    if ($cond['type'] === 'multiplePasscodes' && !empty($cond['value'])) {
                        $lines = explode("\n", $cond['value']);
                        foreach ($lines as $line) $codes[] = trim($line);
                    }
                }
            }
        }
        return $codes;
    }
}

<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Symfony\Component\Process\Process;

/**
 * Resolves the currently-checked-out git revision of the deployed code.
 *
 * Designed for hosts (e.g. aaPanel) where PHP's exec()/proc_open may be
 * disabled: SHA + branch + deploy time are read straight from the plain
 * files in .git (no shell), and the richer commit message/author are filled
 * in via `git log` only when the shell is available. Either way the caller
 * gets the best data the environment can provide instead of nothing.
 */
class GitInfo
{
    /**
     * @return array{commit: ?string, short: ?string, branch: ?string, message: ?string, author: ?string, committed_at: ?string, deployed_at: ?string}|null
     */
    public static function current(): ?array
    {
        // Cache to avoid re-spawning `git log` on every dashboard poll. The
        // cache store may be the database, so degrade to a direct read rather
        // than throwing if the cache backend is unreachable.
        try {
            return Cache::remember('airo.git_info', 60, fn () => self::resolve());
        } catch (\Throwable $e) {
            return self::resolve();
        }
    }

    /** Read git state directly, bypassing the cache (used at deploy time). */
    public static function resolve(): ?array
    {
        $gitDir = base_path('.git');
        if (! is_dir($gitDir)) {
            return null;
        }

        [$sha, $branch, $refPath] = self::readHead($gitDir);
        if ($sha === null) {
            return null;
        }

        $info = [
            'commit' => $sha,
            'short' => substr($sha, 0, 7),
            'branch' => $branch,
            'message' => null,
            'author' => null,
            'committed_at' => null,
            // Proxy for deploy time: when git last rewrote the branch ref
            // (the deploy does `git reset --hard`), which touches this file.
            'deployed_at' => ($refPath && @filemtime($refPath)) ? gmdate('c', filemtime($refPath)) : null,
        ];

        // Best-effort enrichment via the shell. No-op if proc_open is disabled.
        try {
            $p = new Process(['git', 'log', '-1', '--format=%H%n%h%n%s%n%an%n%cI'], base_path());
            $p->setTimeout(5);
            $p->run();
            if ($p->isSuccessful()) {
                $parts = array_pad(explode("\n", trim($p->getOutput())), 5, null);
                $info['commit'] = $parts[0] ?: $info['commit'];
                $info['short'] = $parts[1] ?: $info['short'];
                $info['message'] = $parts[2] ?: null;
                $info['author'] = $parts[3] ?: null;
                $info['committed_at'] = $parts[4] ?: null;
            }
        } catch (\Throwable $e) {
            // Shell unavailable — keep the file-derived SHA/branch/time.
        }

        return $info;
    }

    /**
     * Resolve HEAD to [sha, branch, refFilePath] using only file reads.
     *
     * @return array{0: ?string, 1: ?string, 2: ?string}
     */
    private static function readHead(string $gitDir): array
    {
        $head = @file_get_contents($gitDir.'/HEAD');
        if ($head === false) {
            return [null, null, null];
        }
        $head = trim($head);

        // Detached HEAD: the file holds the raw SHA.
        if (! str_starts_with($head, 'ref:')) {
            return [$head, null, $gitDir.'/HEAD'];
        }

        $ref = trim(substr($head, 4)); // e.g. refs/heads/main
        $branch = str_starts_with($ref, 'refs/heads/')
            ? substr($ref, strlen('refs/heads/'))
            : $ref;

        // Loose ref file.
        $refFile = $gitDir.'/'.$ref;
        if (is_file($refFile)) {
            return [trim((string) @file_get_contents($refFile)), $branch, $refFile];
        }

        // Packed refs fallback.
        $packed = @file_get_contents($gitDir.'/packed-refs');
        if ($packed !== false) {
            foreach (explode("\n", $packed) as $line) {
                if ($line === '' || $line[0] === '#' || $line[0] === '^') {
                    continue;
                }
                [$s, $r] = array_pad(explode(' ', $line, 2), 2, null);
                if ($r !== null && trim($r) === $ref) {
                    return [trim($s), $branch, $gitDir.'/packed-refs'];
                }
            }
        }

        return [null, $branch, null];
    }
}

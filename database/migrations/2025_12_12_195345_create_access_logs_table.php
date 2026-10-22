<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('access_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('access_rule_id')->nullable();
            $table->string('customer_id')->nullable();
            $table->string('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->boolean('granted')->default(false);
            $table->string('reason')->nullable();
            $table->timestamps();

            $table->foreign('access_rule_id')->references('id')->on('access_rules')->onDelete('set null');
            $table->index(['access_rule_id', 'customer_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('access_logs');
    }
};

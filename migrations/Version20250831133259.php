<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20250831133259 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE move_stats DROP CONSTRAINT move_stats_pkey');
        $this->addSql('ALTER TABLE move_stats ADD move VARCHAR(10) NOT NULL');
        $this->addSql('CREATE INDEX IDX_9B4578037C4429CB ON move_stats (fen_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_fen_move ON move_stats (fen_id, move)');
        $this->addSql('ALTER TABLE move_stats ADD PRIMARY KEY (fen_id, move)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE SCHEMA public');
        $this->addSql('DROP INDEX IDX_9B4578037C4429CB');
        $this->addSql('DROP INDEX uniq_fen_move');
        $this->addSql('DROP INDEX move_stats_pkey');
        $this->addSql('ALTER TABLE move_stats DROP move');
        $this->addSql('ALTER TABLE move_stats ADD PRIMARY KEY (fen_id)');
    }
}

<?php

declare(strict_types=1);

namespace main;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20241014130808 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE analysis CHANGE pgn pgn VARCHAR(2048) DEFAULT NULL');
        $this->addSql('ALTER TABLE opponent_game CHANGE pgn pgn VARCHAR(2048) NOT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE analysis CHANGE pgn pgn VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE opponent_game CHANGE pgn pgn VARCHAR(1000) NOT NULL');
    }
}

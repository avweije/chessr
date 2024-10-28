<?php

declare(strict_types=1);

namespace main;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20241014112903 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE opponent_game (id INT AUTO_INCREMENT NOT NULL, opponent_id INT NOT NULL, color VARCHAR(5) NOT NULL, result VARCHAR(5) NOT NULL, pgn VARCHAR(1000) NOT NULL, INDEX IDX_23CFFF1F7F656CDC (opponent_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('CREATE TABLE opponent_move (id INT AUTO_INCREMENT NOT NULL, opponent_id INT NOT NULL, color VARCHAR(5) NOT NULL, fen VARCHAR(255) NOT NULL, pgn VARCHAR(1000) DEFAULT NULL, move VARCHAR(10) NOT NULL, wins INT NOT NULL, draws INT NOT NULL, losses INT NOT NULL, INDEX IDX_EFDAF9EB7F656CDC (opponent_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE opponent_game ADD CONSTRAINT FK_23CFFF1F7F656CDC FOREIGN KEY (opponent_id) REFERENCES opponent (id)');
        $this->addSql('ALTER TABLE opponent_move ADD CONSTRAINT FK_EFDAF9EB7F656CDC FOREIGN KEY (opponent_id) REFERENCES opponent (id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE opponent_game DROP FOREIGN KEY FK_23CFFF1F7F656CDC');
        $this->addSql('ALTER TABLE opponent_move DROP FOREIGN KEY FK_EFDAF9EB7F656CDC');
        $this->addSql('DROP TABLE opponent_game');
        $this->addSql('DROP TABLE opponent_move');
    }
}

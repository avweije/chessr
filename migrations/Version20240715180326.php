<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20240715180326 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE mistakes (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, white VARCHAR(255) NOT NULL, black VARCHAR(255) NOT NULL, link VARCHAR(255) NOT NULL, fen VARCHAR(255) DEFAULT NULL, pgn VARCHAR(255) DEFAULT NULL, move VARCHAR(10) NOT NULL, best_moves VARCHAR(30) NOT NULL, INDEX IDX_A7985196A76ED395 (user_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE mistakes ADD CONSTRAINT FK_A7985196A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE mistakes DROP FOREIGN KEY FK_A7985196A76ED395');
        $this->addSql('DROP TABLE mistakes');
    }
}

<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20240719165249 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE repertoire_group (id INT AUTO_INCREMENT NOT NULL, repertoire_id INT NOT NULL, grp_id INT NOT NULL, INDEX IDX_B1056021E61B789 (repertoire_id), INDEX IDX_B105602D51E9150 (grp_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE repertoire_group ADD CONSTRAINT FK_B1056021E61B789 FOREIGN KEY (repertoire_id) REFERENCES repertoire (id)');
        $this->addSql('ALTER TABLE repertoire_group ADD CONSTRAINT FK_B105602D51E9150 FOREIGN KEY (grp_id) REFERENCES `group` (id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE repertoire_group DROP FOREIGN KEY FK_B1056021E61B789');
        $this->addSql('ALTER TABLE repertoire_group DROP FOREIGN KEY FK_B105602D51E9150');
        $this->addSql('DROP TABLE repertoire_group');
    }
}
